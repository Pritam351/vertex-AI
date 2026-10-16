
const mongoose = require("mongoose");
const TranscriptChunk = require("./transcriptChunkModel");
const { generateEmbedding } = require("./embeddingService");

async function searchCourseTranscript(courseId, question) {
  if (!mongoose.isValidObjectId(courseId)) {
    const error = new Error("Invalid course ID");
    error.statusCode = 400;
    throw error;
  }

  if (typeof question !== "string" || !question.trim()) {
    const error = new Error("Please provide a question");
    error.statusCode = 400;
    throw error;
  }

  const queryEmbedding = await generateEmbedding(question.trim());

  return TranscriptChunk.aggregate([
    {
      $vectorSearch: {
        index: "transcript_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 50,
        limit: 5,
        filter: {
          courseId: new mongoose.Types.ObjectId(courseId),
        },
      },
    },
    {
      $project: {
        _id: 1,
        courseId: 1,
        lectureId: 1,
        chunkIndex: 1,
        text: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);
}

module.exports = { searchCourseTranscript };
