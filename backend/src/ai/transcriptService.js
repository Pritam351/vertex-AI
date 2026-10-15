
const mongoose = require("mongoose");
const TranscriptChunk = require("./transcriptChunkModel");

const CourseModule = require("../modules/courses/moduleModel");
const contentService = require("../modules/courses/contentService");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

function cleanTranscript(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkTranscript(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);

      if (boundary > start + chunkSize * 0.7) {
        end = boundary;
      }
    }

    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) break;

    start = end - overlap;
  }

  return chunks;
}

async function ingestLecture(lectureId, user) {
  if (!mongoose.isValidObjectId(lectureId)) {
    fail(400, "Invalid lecture ID");
  }

  // Reuse the existing authorization check.
  const lecture = await contentService.getLectureForEditor(
    lectureId,
    user
  );

  if (!lecture) {
    fail(404, "Lecture not found");
  }

  if (
    typeof lecture.transcript !== "string" ||
    !lecture.transcript.trim()
  ) {
    fail(400, "This lecture has no transcript to ingest");
  }

  const module = await CourseModule.findById(lecture.moduleId)
    .select("courseId");

  if (!module) {
    fail(404, "Lecture module not found");
  }

  const courseId = module.courseId;
  const cleanedText = cleanTranscript(lecture.transcript);
  const chunks = chunkTranscript(cleanedText);

  if (chunks.length === 0) {
    fail(400, "Transcript contains no usable text");
  }

  // Replace old chunks only after preparing the new ones.
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await TranscriptChunk.deleteMany(
        { lectureId: lecture._id },
        { session }
      );

      const documents = chunks.map((text, chunkIndex) => ({
        courseId,
        lectureId: lecture._id,
        chunkIndex,
        text,
      }));

      await TranscriptChunk.insertMany(documents, { session });
    });
  } finally {
    await session.endSession();
  }

  return {
    lectureId: lecture._id,
    courseId,
    chunkCount: chunks.length,
    chunks: chunks.map((text, chunkIndex) => ({
      chunkIndex,
      characters: text.length,
    })),
  };
}

module.exports = { ingestLecture };
