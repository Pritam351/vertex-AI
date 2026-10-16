
const mongoose = require("mongoose");

const transcriptChunkSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
  },
  { timestamps: true }
);

transcriptChunkSchema.index(
  { lectureId: 1, chunkIndex: 1 },
  { unique: true }
);

transcriptChunkSchema.index({ courseId: 1, lectureId: 1 });

module.exports = mongoose.model("TranscriptChunk", transcriptChunkSchema);
