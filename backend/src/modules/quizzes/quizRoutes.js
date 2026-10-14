
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createQuiz,
  listCourseQuizzes,
  startAttempt,
  submitAttempt,
  getMyAttempts,
} = require("./quizController");

const router = express.Router();

router.post(
  "/quizzes",
  authMiddleware,
  requireRole("instructor", "admin"),
  createQuiz
);

router.get(
  "/courses/:courseId/quizzes",
  authMiddleware,
  listCourseQuizzes
);

router.post(
  "/quizzes/:id/attempt",
  authMiddleware,
  requireRole("student"),
  startAttempt
);

router.post(
  "/attempts/:id/submit",
  authMiddleware,
  requireRole("student"),
  submitAttempt
);

router.get(
  "/quiz-attempts/me",
  authMiddleware,
  requireRole("student"),
  getMyAttempts
);

module.exports = router;
