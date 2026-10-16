
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

  return instructions[difficulty];
}

async function sendChatMessage(req, res, next) {
  try {
    const { courseId } = req.params;
    const { question, sessionId, difficulty = "beginner" } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a question",
      });
    }

    if (question.trim().length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Question cannot exceed 4000 characters",
      });
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be beginner, intermediate, or advanced",
      });
    }

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
        title: question.trim().slice(0, 80),
        messages: [],
      });
    }

    // Save the student's question immediately.
    session.messages.push({
    role: "user",
    content: question.trim(),
    difficulty,
    });

    session.lastMessageAt = new Date();
    await session.save();

    const chunks = await searchCourseTranscript(
      course._id,
      question.trim()
    );

    const lectureIds = [
      ...new Set(chunks.map((chunk) => chunk.lectureId.toString())),
    ];

    const lectures = await Lecture.find({
      _id: { $in: lectureIds },
    })
      .select("_id title moduleId")
      .lean();

    const moduleIds = [
      ...new Set(
        lectures
          .filter((lecture) => lecture.moduleId)
          .map((lecture) => lecture.moduleId.toString())
      ),
    ];

    const modules = await CourseModule.find({
      _id: { $in: moduleIds },
    })
      .select("_id courseId")
      .lean();

    const validModuleIds = new Set(
      modules
        .filter(
          (module) =>
            module.courseId.toString() === course._id.toString()
        )
        .map((module) => module._id.toString())
    );

    const validLectures = new Map(
      lectures
        .filter(
          (lecture) =>
            lecture.moduleId &&
            validModuleIds.has(lecture.moduleId.toString())
        )
        .map((lecture) => [lecture._id.toString(), lecture])
    );

    const sources = chunks
      .filter(
        (chunk) =>
          chunk.courseId.toString() === course._id.toString() &&
          validLectures.has(chunk.lectureId.toString()) &&
          chunk.score >= 0.60
      )
      .map((chunk) => ({
        lectureId: chunk.lectureId,
        lectureTitle: validLectures.get(
          chunk.lectureId.toString()
        ).title,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        score: chunk.score,
      }));

    let answer;

    if (sources.length === 0) {
      answer =
        "I couldn't find sufficiently relevant information in this course's lecture materials. Please try rephrasing your question.";
    } else {
      const context = sources
        .map(
          (source, index) =>
            `[Source ${index + 1}: ${source.lectureTitle}, chunk ${source.chunkIndex}]\n${source.text}`
        )
        .join("\n\n");

      const prompt = `
You are the AI tutor for the course "${course.title || "this course"}".

Answer the student's question using only the supplied course material.
Do not invent facts or use outside knowledge.
If the material does not contain the answer, say so.
Cite relevant material using labels such as [Source 1].

Difficulty: ${difficulty}
${getDifficultyInstructions(difficulty)}

COURSE MATERIAL:
${context}

STUDENT QUESTION:
${question.trim()}
`;

      answer = await generateResponse(prompt);
    }

    const savedSources = sources.map((source) => ({
      lectureId: source.lectureId,
      lectureTitle: source.lectureTitle,
      chunkIndex: source.chunkIndex,
    }));

    session.messages.push({
      role: "assistant",
      content: answer,
      difficulty,
      sources: savedSources,
    });

    session.lastMessageAt = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      sessionId: session._id,
      difficulty,
      answer,
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
      .select("_id title lastMessageAt createdAt")
      .sort({ lastMessageAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
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
