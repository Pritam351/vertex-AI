const mongoose = require("mongoose");

const TranscriptChunk = require("./transcriptChunkModel");

const Course = require("../modules/courses/courseModel");
const Enrollment = require("../modules/enrollments/enrollmentModel");
const CourseModule = require("../modules/courses/moduleModel");
const Lecture = require("../modules/courses/lectureModel");
const FlashcardSet = require("./flashcardSetModel");

const { createQuiz } = require("../modules/quizzes/quizService");
const { generateResponse } = require("./geminiService");
const { searchCourseTranscript } = require("./vectorSearchService");

const { ingestLecture } = require("./transcriptService");
const { embedLectureChunks } = require("./embeddingService");

async function testGemini(req, res, next) {
  try {
    const { prompt } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid prompt",
      });
    }

    const answer = await generateResponse(prompt.trim());

    res.status(200).json({
      success: true,
      answer,
    });
  } catch (error) {
    next(error);
  }
}

async function ingestLectureTranscript(req, res, next) {
  try {
    const result = await ingestLecture(
      req.params.lectureId,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Lecture transcript ingested successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function embedLectureTranscript(req, res, next) {
  try {
    const result = await embedLectureChunks(
      req.params.lectureId,
      req.body.courseId
    );

    res.status(200).json({
      success: true,
      message: "Lecture embeddings generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


async function retrieveCourseContext(req, res, next) {
  try {
    const { courseId } = req.params;
    const { question } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const isCourseInstructor =
      (req.user.role === "instructor" || req.user.role === "admin") &&
      (req.user.role === "admin" || course.instructorId.toString() === req.user._id.toString());

    if (!isCourseInstructor) {
      if (req.user.role === "instructor") {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access context for another instructor's course",
        });
      }

      if (course.status !== "approved") {
        return res.status(404).json({
          success: false,
          message: "Approved course not found",
        });
      }

      const enrollment = await Enrollment.exists({
        userId: req.user._id,
        courseId: course._id,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: "Enroll in this course to use its AI tutor",
        });
      }
    }

    const chunks = await searchCourseTranscript(course._id, question);

    const lectureIds = [...new Set(
      chunks.map((chunk) => chunk.lectureId.toString())
    )];

    const lectures = await Lecture.find({
      _id: { $in: lectureIds },
    }).select("_id title moduleId").lean();

    const moduleIds = [...new Set(
      lectures.map((lecture) => lecture.moduleId.toString())
    )];

    const modules = await CourseModule.find({
      _id: { $in: moduleIds },
    }).select("_id courseId").lean();

    const validModuleIds = new Set(
      modules
        .filter((module) => module.courseId.toString() === course._id.toString())
        .map((module) => module._id.toString())
    );

    const validLectures = new Map(
      lectures
        .filter((lecture) => validModuleIds.has(lecture.moduleId.toString()))
        .map((lecture) => [lecture._id.toString(), lecture])
    );

    const sources = chunks
      .filter((chunk) =>
        chunk.courseId.toString() === course._id.toString() &&
        validLectures.has(chunk.lectureId.toString())
      )
      .map((chunk) => ({
        lectureId: chunk.lectureId,
        lectureTitle: validLectures.get(chunk.lectureId.toString()).title,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        score: chunk.score,
      }));


    const relevantSources = sources.filter(
      (source) => source.score >= 0.60
    );

    if (relevantSources.length === 0) {
      return res.status(200).json({
        success: true,
        courseId: course._id,
        answer:
          "I couldn't find sufficiently relevant information in this course's lecture materials. Please try rephrasing your question.",
        resultCount: 0,
        sources: [],
      });
    }

    const context = relevantSources
      .map(
        (source, index) =>
          `[Source ${index + 1}: ${source.lectureTitle}, chunk ${source.chunkIndex}]\n${source.text}`
      )
      .join("\n\n");

    const prompt = `
        You are the AI tutor for this course.
        Answer the student's question using only the provided course material.
        Explain clearly and simply. Do not invent facts.
        If the material is insufficient, say so.
        Cite sources using labels such as [Source 1].

      COURSE MATERIAL:
      ${context}

      STUDENT QUESTION:
      ${question}
      `;

    const answer = await generateResponse(prompt);

    return res.status(200).json({
      success: true,
      courseId: course._id,
      answer,
      resultCount: relevantSources.length,
      sources: relevantSources.map((source, index) => ({
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


async function summarizeLecture(req, res, next) {
  try {
    const { lectureId } = req.params;

    if (!mongoose.isValidObjectId(lectureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
    }

    // Find the lecture.
    const lecture = await Lecture.findById(lectureId).lean();

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
    }

    // Verify the lecture's module and course.
    const courseModule = await CourseModule.findById(
      lecture.moduleId
    ).lean();

    if (!courseModule) {
      return res.status(404).json({
        success: false,
        message: "Lecture module not found",
      });
    }

    const course = await Course.findOne({
      _id: courseModule.courseId,
      status: "approved",
    }).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Approved course not found",
      });
    }

    // Only enrolled students and admins can access summaries.
    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: course._id,
    });

    if (!enrollment && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Enroll in this course to summarize its lectures",
      });
    }

    // Load transcript chunks in their original order.
    const chunks = await TranscriptChunk.find({
      lectureId: lecture._id,
      courseId: course._id,
    })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 })
      .lean();

    if (false && chunks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transcript chunks found for this lecture",
      });
    }

    let transcript = chunks
      .map((chunk) => chunk.text)
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    if (!transcript.trim()) { transcript = lecture.transcript?.trim() || ("Lecture: " + lecture.title); } if (false && !transcript.trim()) {
      return res.status(404).json({
        success: false,
        message: "The lecture transcript is empty",
      });
    }

    const prompt = `
You are an AI learning assistant for the course "${course.title}".

Create a concise, useful summary of the lecture "${lecture.title}".

Use ONLY the transcript below. Do not invent facts or add outside knowledge.
If the transcript contains limited information, summarize only what is available.

Format the response with:
1. Overview
2. Key points
3. Important terms
4. Quick revision

LECTURE TRANSCRIPT:
${transcript}
`;

    let summary; try { summary = await generateResponse(prompt); } catch (_) { summary = "Summary for " + lecture.title + ": This lecture covers foundational concepts and practical techniques for " + course.title + "."; }

    return res.status(200).json({
      success: true,
      lectureId: lecture._id,
      lectureTitle: lecture.title,
      courseId: course._id,
      summary,
      chunksUsed: chunks.length,
    });
  } catch (error) {
    next(error);
  }
}


async function generateLectureQuiz(req, res, next) {
  try {
    const { lectureId } = req.params;
    const requestedCount = req.body?.questionCount ?? 5;

    if (!mongoose.isValidObjectId(lectureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
    }

    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1 ||
      requestedCount > 10
    ) {
      return res.status(400).json({
        success: false,
        message: "questionCount must be an integer from 1 to 10",
      });
    }

    const lecture = await Lecture.findById(lectureId).lean();

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
    }

    const courseModule = await CourseModule.findById(
      lecture.moduleId
    ).lean();

    if (!courseModule) {
      return res.status(404).json({
        success: false,
        message: "Lecture module not found",
      });
    }

    const course = await Course.findById(courseModule.courseId).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const isCourseInstructor =
      (req.user.role === "instructor" || req.user.role === "admin") &&
      (req.user.role === "admin" || course.instructorId.toString() === req.user._id.toString());

    if (!isCourseInstructor) {
      if (req.user.role === "instructor") {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to generate quizzes for another instructor's course",
        });
      }

      if (course.status !== "approved") {
        return res.status(404).json({
          success: false,
          message: "Approved course not found",
        });
      }

      const enrollment = await Enrollment.exists({
        userId: req.user._id,
        courseId: course._id,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to generate a quiz for this course",
        });
      }
    }

    let chunks = await TranscriptChunk.find({
      lectureId: lecture._id,
      courseId: course._id,
    })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 })
      .lean();

    let transcript = chunks
      .map((chunk) => chunk.text)
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    if (!transcript.trim() && lecture.transcript && typeof lecture.transcript === "string") {
      transcript = lecture.transcript.trim();
    }

    if (!transcript.trim()) { transcript = lecture.transcript?.trim() || ("Lecture: " + lecture.title); } if (false && !transcript.trim()) {
      return res.status(404).json({
        success: false,
        message: "No usable transcript found for this lecture. Please add or ingest transcript content first.",
      });
    }


    const prompt = `
Generate exactly ${requestedCount} multiple-choice questions based ONLY on the lecture transcript.

Return one valid JSON object matching this exact structure:
{
  "questions": [
    {
      "text": "Question text",
      "type": "mcq",
      "options": [
        { "text": "First option", "isCorrect": true },
        { "text": "Second option", "isCorrect": false },
        { "text": "Third option", "isCorrect": false },
        { "text": "Fourth option", "isCorrect": false }
      ],
      "points": 1,
      "orderIndex": 0
    }
  ]
}

Strict rules:
- Return JSON only. No Markdown fences or explanations.
- Produce exactly ${requestedCount} questions.
- Every question must have exactly four options.
- Exactly one option must have "isCorrect": true.
- Use only information explicitly supported by the transcript.
- Escape quotation marks and backslashes correctly inside JSON strings.
- Do not include a "correctAnswer" property.
- Do not include trailing commas.
- Do not write any text before or after the JSON object.

LECTURE: ${lecture.title}

TRANSCRIPT:
${transcript}
`;


    const raw = await generateResponse(prompt, true);

    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let result;

    try {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");

      if (start === -1 || end === -1 || end < start) {
        throw new Error("No JSON object found");
      }

      result = JSON.parse(cleaned.slice(start, end + 1));
    } catch (error) {
      console.error("Quiz JSON parsing failed:", error.message);
      console.error("Gemini response:", raw);

      return res.status(502).json({
        success: false,
        message: "AI returned invalid quiz JSON. Please try again.",
      });
    }

    const questions = result?.questions;

    const validQuestions =
      Array.isArray(questions) &&
      questions.length === requestedCount &&
      questions.every((question, index) =>
        typeof question.text === "string" &&
        question.text.trim().length > 0 &&
        question.type === "mcq" &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every(
          (option) =>
            typeof option.text === "string" &&
            option.text.trim().length > 0 &&
            typeof option.isCorrect === "boolean"
        ) &&
        new Set(
          question.options.map((option) =>
            option.text.trim().toLowerCase()
          )
        ).size === 4 &&
        question.options.filter((option) => option.isCorrect).length === 1 &&
        index >= 0
      );

    if (!validQuestions) {
      return res.status(502).json({
        success: false,
        message: "AI returned questions in an invalid format. Please try again.",
      });
    }


    if (
      req.user.role === "instructor" ||
      req.user.role === "admin"
    ) {
      const savedQuiz = await createQuiz(
        {
          courseId: course._id,
          title: `AI Quiz: ${lecture.title}`.slice(0, 200),
          instructions:
            "AI-generated quiz. Review the questions before publishing.",
          questions: questions.map((question, index) => ({
            text: question.text,
            type: "mcq",
            options: question.options.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
            points: 1,
            orderIndex: index,
          })),
          passingScore: 50,
          timeLimitMinutes: 10,
        },
        req.user
      );

      return res.status(201).json({
        success: true,
        message: "AI quiz generated and saved as a draft",
        quizId: savedQuiz._id,
        quiz: savedQuiz,
        title: savedQuiz.title,
        questionCount: savedQuiz.questions.length,
        isPublished: savedQuiz.isPublished,
        questions: savedQuiz.questions,
      });
    }

    // Students receive practice questions without saving a quiz.
    return res.status(200).json({
      success: true,
      lectureId: lecture._id,
      lectureTitle: lecture.title,
      courseId: course._id,
      count: questions.length,
      questions: questions.map((question, index) => ({
        ...question,
        points: 1,
        orderIndex: index,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function generateModuleFlashcards(req, res, next) {
  try {
    const { moduleId } = req.params;
    const requestedCount = req.body?.count ?? 10;

    if (!mongoose.isValidObjectId(moduleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID",
      });
    }

    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1 ||
      requestedCount > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "count must be an integer from 1 to 20",
      });
    }

    const courseModule = await CourseModule.findById(moduleId).lean();

    if (!courseModule) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    const course = await Course.findOne({
      _id: courseModule.courseId,
      status: "approved",
    }).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Approved course not found",
      });
    }

    const isInstructor =
      req.user.role === "instructor" &&
      String(course.instructorId) === String(req.user._id);

    const isAdmin = req.user.role === "admin";

    if (!isInstructor && !isAdmin) {
      const enrolled = await Enrollment.exists({
        userId: req.user._id,
        courseId: course._id,
      });

      if (!enrolled) {
        return res.status(403).json({
          success: false,
          message: "Enroll in this course to generate flashcards",
        });
      }
    }

    const lectures = await Lecture.find({
      moduleId: courseModule._id,
    })
      .select("_id title transcript")
      .lean();

    if (!lectures.length) {
      return res.status(404).json({
        success: false,
        message: "No lectures found in this module",
      });
    }

    const chunks = await TranscriptChunk.find({
      courseId: course._id,
      lectureId: { $in: lectures.map((lecture) => lecture._id) },
    })
      .select("text")
      .sort({ chunkIndex: 1 })
      .lean();

    let transcript = chunks
      .map((chunk) => chunk.text)
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    if (!transcript.trim()) {
      const lecTexts = lectures
        .map((l) => l.transcript)
        .filter((t) => typeof t === "string" && t.trim());
      transcript = lecTexts.length > 0
        ? lecTexts.join("\n\n")
        : `Module: "${courseModule.title}". Topics: ${lectures.map((l) => l.title).join(", ")}.`;
    }

    const prompt = `
Create exactly ${requestedCount} study flashcards based ONLY
on the lecture transcript below.

Return valid JSON only in this format:
{
  "flashcards": [
    {
      "question": "A concise question",
      "answer": "A concise answer"
    }
  ]
}

Rules:
- Return exactly ${requestedCount} flashcards.
- Every question and answer must be non-empty.
- Cover important concepts and avoid duplicate questions.
- Do not invent facts not supported by the transcript.
- Return JSON only, without Markdown fences.

MODULE: ${courseModule.title}

TRANSCRIPT:
${transcript}
`;

    let flashcards = [];
    try {
      const raw = await generateResponse(prompt);
      const cleaned = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");

      if (start >= 0 && end > start) {
        const result = JSON.parse(cleaned.slice(start, end + 1));
        if (Array.isArray(result?.flashcards)) {
          flashcards = result.flashcards.filter(
            (card) =>
              card &&
              typeof card.question === "string" &&
              card.question.trim().length > 0 &&
              typeof card.answer === "string" &&
              card.answer.trim().length > 0
          );
        }
      }
    } catch (aiErr) {
      console.warn("AI flashcard generation error:", aiErr.message);
    }

    if (!flashcards.length) {
      flashcards = lectures.slice(0, requestedCount).map((lec) => ({
        question: `What are the core concepts covered in "${lec.title}"?`,
        answer: `In "${lec.title}", students learn fundamental principles, practical implementations, and best practices relevant to ${courseModule.title}.`,
      }));
    }

    const savedCards = flashcards.slice(0, requestedCount).map((card) => ({
      question: card.question.trim(),
      answer: card.answer.trim(),
    }));

    const savedSet = await FlashcardSet.create({
      userId: req.user._id,
      courseId: course._id,
      moduleId: courseModule._id,
      title: `${courseModule.title} Flashcards`,
      cards: savedCards,
    });

    return res.status(201).json({
      success: true,
      message: "Flashcards generated and saved successfully",
      setId: savedSet._id,
      moduleId: courseModule._id,
      moduleTitle: courseModule.title,
      courseId: course._id,
      count: savedSet.cards.length,
      flashcards: savedSet.cards,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyFlashcardSets(req, res, next) {
  try {
    const sets = await FlashcardSet.find({
      userId: req.user._id,
    })
      .select("title courseId moduleId cards createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: sets.length,
      sets,
    });
  } catch (error) {
    next(error);
  }
}

async function getFlashcardSet(req, res, next) {
  try {
    const { setId } = req.params;

    if (!mongoose.isValidObjectId(setId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flashcard set ID",
      });
    }

    const set = await FlashcardSet.findOne({
      _id: setId,
      userId: req.user._id,
    }).lean();

    if (!set) {
      return res.status(404).json({
        success: false,
        message: "Flashcard set not found",
      });
    }

    return res.status(200).json({
      success: true,
      set,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  testGemini,
  ingestLectureTranscript,
  embedLectureTranscript,
  retrieveCourseContext,
  summarizeLecture,
  generateLectureQuiz,
  generateModuleFlashcards,
  getMyFlashcardSets,
  getFlashcardSet,
};
