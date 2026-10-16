const mongoose = require("mongoose");

const Course = require("../modules/courses/courseModel");
const Enrollment = require("../modules/enrollments/enrollmentModel");
const CourseModule = require("../modules/courses/moduleModel");
const Lecture = require("../modules/courses/lectureModel");

const { searchCourseTranscript } = require("./vectorSearchService");

const { generateResponse } = require("./geminiService");
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

    return res.status(200).json({
      success: true,
      courseId: course._id,
      resultCount: sources.length,
      sources,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { testGemini, ingestLectureTranscript, embedLectureTranscript, retrieveCourseContext };
