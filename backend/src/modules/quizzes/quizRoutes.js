
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createQuiz,
  updateQuiz,
  listCourseQuizzes,
  startAttempt,
  submitAttempt,
  getMyAttempts,
  publishQuiz,
} = require("./quizController");

const router = express.Router();

router.post(
  "/quizzes",
  authMiddleware,
  requireRole("instructor", "admin"),
  createQuiz
);

router.put(
  "/quizzes/:id",
  authMiddleware,
  requireRole("instructor", "admin"),
  updateQuiz
);


router.patch(
  "/quizzes/:id/publish",
  authMiddleware,
  requireRole("instructor", "admin"),
  publishQuiz
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
