
const mongoose = require("mongoose");

const moduleSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
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
    orderIndex: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

moduleSchema.index({ courseId: 1, orderIndex: 1 });

module.exports = mongoose.model("CourseModule", moduleSchema);
