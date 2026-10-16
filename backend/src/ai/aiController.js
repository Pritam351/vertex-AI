const mongoose = require("mongoose");

const TranscriptChunk = require("./transcriptChunkModel");

const Course = require("../modules/courses/courseModel");
const Enrollment = require("../modules/enrollments/enrollmentModel");
const CourseModule = require("../modules/courses/moduleModel");
const Lecture = require("../modules/courses/lectureModel");

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

    if (chunks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transcript chunks found for this lecture",
      });
    }

    const transcript = chunks
      .map((chunk) => chunk.text)
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    if (!transcript.trim()) {
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

    const summary = await generateResponse(prompt);

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

    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: course._id,
    });

    if (!enrollment && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Enroll in this course to generate a practice quiz",
      });
    }

    const chunks = await TranscriptChunk.find({
      lectureId: lecture._id,
      courseId: course._id,
    })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 })
      .lean();

    const transcript = chunks
      .map((chunk) => chunk.text)
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    if (!transcript.trim()) {
      return res.status(404).json({
        success: false,
        message: "No usable transcript found for this lecture",
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



module.exports = { testGemini, ingestLectureTranscript, embedLectureTranscript, retrieveCourseContext, summarizeLecture,generateLectureQuiz, };
