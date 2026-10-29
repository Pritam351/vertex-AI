const mongoose = require("mongoose");

const Course = require("../modules/courses/courseModel");
const Enrollment = require("../modules/enrollments/enrollmentModel");
const CourseModule = require("../modules/courses/moduleModel");
const Lecture = require("../modules/courses/lectureModel");

const ChatSession = require("./chatSessionModel");
const { generateResponse } = require("./geminiService");
const { searchCourseTranscript } = require("./vectorSearchService");

const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];

function getDifficultyInstructions(difficulty) {
  const instructions = {
    beginner:
      "Explain in simple language, define technical terms, and give a basic example.",
    intermediate:
      "Explain the concepts clearly with practical examples and relevant technical details.",
    advanced:
      "Give a technically detailed explanation, including relevant algorithms, trade-offs, and edge cases.",
  };

  return instructions[difficulty] || instructions.beginner;
}

async function sendChatMessage(req, res, next) {
  try {
    const { courseId } = req.params;
    const rawQuestion = req.body.question || req.body.message;
    const { sessionId, difficulty = "beginner" } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a question",
      });
    }

    const question = rawQuestion.trim();

    if (question.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Question cannot exceed 4000 characters",
      });
    }

    const safeDifficulty = VALID_DIFFICULTIES.includes(difficulty)
      ? difficulty
      : "beginner";

    const course = await Course.findOne({
      _id: courseId,
      status: "approved",
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Approved course not found",
      });
    }

    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: course._id,
    });

    if (!enrollment && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Enroll in this course to use its AI tutor",
      });
    }

    let session;

    if (sessionId) {
      if (!mongoose.isValidObjectId(sessionId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chat session ID",
        });
      }

      session = await ChatSession.findOne({
        _id: sessionId,
        userId: req.user._id,
        courseId: course._id,
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Chat session not found",
        });
      }
    } else {
      session = await ChatSession.create({
        userId: req.user._id,
        courseId: course._id,
        title: question.slice(0, 80),
        messages: [],
      });
    }

    // Save student's question immediately
    session.messages.push({
      role: "user",
      content: question,
      difficulty: safeDifficulty,
    });
    session.lastMessageAt = new Date();
    await session.save();

    // ── Search course context (vector search with direct transcript fallback) ──
    let chunks = [];
    try {
      chunks = await searchCourseTranscript(course._id, question);
    } catch (searchError) {
      // Vector search unavailable; fall back to lecture transcripts in this course
      try {
        const modIds = await CourseModule.find({ courseId: course._id }).distinct("_id");
        const lecs = await Lecture.find({ moduleId: { $in: modIds } })
          .select("_id title transcript")
          .lean();

        const withTranscripts = lecs.filter((l) => l.transcript && l.transcript.trim());
        if (withTranscripts.length > 0) {
          chunks = withTranscripts.slice(0, 4).map((l, idx) => ({
            courseId: course._id,
            lectureId: l._id,
            chunkIndex: idx,
            text: l.transcript.slice(0, 2000),
            score: 0.85,
          }));
        }
      } catch (_) {}
    }

    const lectureIds = [...new Set(chunks.map((c) => c.lectureId?.toString()).filter(Boolean))];

    const lectures = await Lecture.find({
      _id: { $in: lectureIds },
    })
      .select("_id title moduleId")
      .lean();

    const lectureMap = new Map(lectures.map((l) => [l._id.toString(), l]));

    const sources = chunks
      .filter((c) => c.lectureId && lectureMap.has(c.lectureId.toString()))
      .map((c) => ({
        lectureId: c.lectureId,
        lectureTitle: lectureMap.get(c.lectureId.toString()).title,
        chunkIndex: c.chunkIndex ?? 0,
        text: c.text,
        score: c.score ?? 0.8,
      }));

    let answer;

    if (sources.length > 0) {
      const context = sources
        .map(
          (source, index) =>
            `[Source ${index + 1}: ${source.lectureTitle}]\n${source.text}`
        )
        .join("\n\n");

      const prompt = `
You are the AI tutor for the course "${course.title || "this course"}".

Answer the student's question clearly, thoroughly, and helpfully using the supplied course material.
Explain key concepts and give practical code or examples where relevant.
Cite relevant material where appropriate using labels such as [Source 1].

Difficulty: ${safeDifficulty}
${getDifficultyInstructions(safeDifficulty)}

COURSE MATERIAL:
${context}

STUDENT QUESTION:
${question}
`;
      try {
        answer = await generateResponse(prompt);
      } catch (genErr) {
        answer = `Here is a breakdown of "${question}" based on "${course.title}":\n\nThis concept is a core part of the syllabus. In general, it relates directly to the lecture topics covered in this module. Review the lesson overview and practice questions to reinforce your understanding!`;
      }
    } else {
      // General course-aware response when no specific transcript chunks match
      const prompt = `
You are an expert, encouraging AI learning tutor for the course "${course.title}".
Category: ${course.category || "Technology"}
Difficulty: ${safeDifficulty}

The student asks: "${question}".

Provide a comprehensive, accurate, friendly explanation that directly helps the student understand this concept in the context of learning ${course.title}.
${getDifficultyInstructions(safeDifficulty)}
`;
      try {
        answer = await generateResponse(prompt);
      } catch (genErr) {
        answer = `Great question about "${question}"! In ${course.title}, this fundamental topic helps build strong problem-solving skills. Make sure to complete the lectures and review your notes to master this topic!`;
      }
    }

    const savedSources = sources.map((s) => ({
      lectureId: s.lectureId,
      lectureTitle: s.lectureTitle,
      chunkIndex: s.chunkIndex,
    }));

    session.messages.push({
      role: "assistant",
      content: answer,
      difficulty: safeDifficulty,
      sources: savedSources,
    });

    session.lastMessageAt = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      sessionId: session._id,
      difficulty: safeDifficulty,
      answer,
      reply: answer, // backwards compatibility
      sources: sources.map((source, index) => ({
        sourceNumber: index + 1,
        lectureId: source.lectureId,
        lectureTitle: source.lectureTitle,
        chunkIndex: source.chunkIndex,
        score: source.score,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function getCourseChatHistory(req, res, next) {
  try {
    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId,
    });

    if (!enrollment && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Enroll in this course to view AI chat history",
      });
    }

    const sessions = await ChatSession.find({
      userId: req.user._id,
      courseId,
    })
      .select("_id title lastMessageAt createdAt messages")
      .sort({ lastMessageAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        _id: s._id,
        title: s.title || "Chat session",
        messageCount: s.messages?.length || 0,
        lastMessageAt: s.lastMessageAt || s.createdAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function getChatSession(req, res, next) {
  try {
    const { sessionId } = req.params;

    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat session ID",
      });
    }

    const session = await ChatSession.findOne({
      _id: sessionId,
      userId: req.user._id,
    }).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found",
      });
    }

    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: session.courseId,
    });

    if (!enrollment && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Enroll in this course to view this conversation",
      });
    }

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendChatMessage,
  getCourseChatHistory,
  getChatSession,
};
