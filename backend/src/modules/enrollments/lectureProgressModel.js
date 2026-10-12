
const mongoose = require("mongoose");

const lectureProgressSchema = new mongoose.Schema(
  {
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    watchedSeconds: {
      type: Number,
      min: 0,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

lectureProgressSchema.index(
  { enrollmentId: 1, lectureId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "LectureProgress",
  lectureProgressSchema
);
