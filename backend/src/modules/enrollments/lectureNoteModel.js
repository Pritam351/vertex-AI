
const mongoose = require("mongoose");

const lectureNoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
  },
  { timestamps: true }
);

// One personal note per student per lecture.
lectureNoteSchema.index(
  { userId: 1, lectureId: 1 },
  { unique: true }
);

module.exports = mongoose.model("LectureNote", lectureNoteSchema);
