
const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: true }
);

const flashcardSetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    cards: {
      type: [flashcardSchema],
      required: true,
      validate: {
        validator: (cards) => cards.length > 0,
        message: "A flashcard set must contain at least one card",
      },
    },
  },
  { timestamps: true }
);

flashcardSetSchema.index({ userId: 1, moduleId: 1, createdAt: -1 });

module.exports = mongoose.model("FlashcardSet", flashcardSetSchema);
