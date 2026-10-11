
const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    videoUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },
    transcript: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100000,
    },
    durationSeconds: {
      type: Number,
      min: 0,
      default: 0,
    },
    orderIndex: {
      type: Number,
      required: true,
      min: 1,
    },
    resourceUrls: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

lectureSchema.index({ moduleId: 1, orderIndex: 1 });

module.exports = mongoose.model("Lecture", lectureSchema);
