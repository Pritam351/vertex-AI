
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

module.exports = { testGemini, ingestLectureTranscript, embedLectureTranscript };
