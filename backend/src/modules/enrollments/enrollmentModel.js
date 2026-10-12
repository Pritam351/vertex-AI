
const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    progressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { timestamps: true }
);

// One enrollment per student per course.
enrollmentSchema.index(
  { userId: 1, courseId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Enrollment", enrollmentSchema);
