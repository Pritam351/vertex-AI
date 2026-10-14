
const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ["mcq", "multi_select", "short_answer"],
      required: true,
    },
    options: {
      type: [optionSchema],
      default: [],
    },
    correctAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    orderIndex: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
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
      minlength: 3,
      maxlength: 200,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (questions) => questions.length > 0,
        message: "A quiz must contain at least one question",
      },
    },
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    timeLimitMinutes: {
      type: Number,
      min: 1,
      max: 300,
      default: 30,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

quizSchema.index({ courseId: 1, createdAt: -1 });

module.exports = mongoose.model("Quiz", quizSchema);
