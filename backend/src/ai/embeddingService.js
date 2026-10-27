
const path = require("path");
require("dotenv").config();
if (!process.env.GEMINI_API_KEY) {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
}

const { GoogleGenAI } = require("@google/genai");
const TranscriptChunk = require("./transcriptChunkModel");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || values.length !== 768) {
    throw new Error("Failed to generate a valid embedding");
  }

  return values;
}


async function generateQueryEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || values.length !== 768) {
    throw new Error("Failed to generate a valid query embedding");
  }

  return values;
}


async function embedLectureChunks(lectureId, courseId) {
  const chunks = await TranscriptChunk.find({
    lectureId,
    courseId,
  }).sort({ chunkIndex: 1 });

  if (chunks.length === 0) {
    const error = new Error("No transcript chunks found for this lecture");
    error.statusCode = 404;
    throw error;
  }

  let processed = 0;

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);

    await TranscriptChunk.updateOne(
      {
        _id: chunk._id,
        lectureId,
        courseId,
      },
      {
        $set: { embedding },
      }
    );

    processed++;
  }

  return {
    lectureId,
    courseId,
    processedChunks: processed,
    dimensions: 768,
  };
}

module.exports = {
  generateEmbedding,
  generateQueryEmbedding,
  embedLectureChunks,
};
