
const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createAssignment,
  listCourseAssignments,
  submitAssignment,
  getMySubmissions,
  gradeSubmission,
} = require("./assignmentController");

const router = express.Router();

// Read assignments for an enrolled student or authorized course owner.
router.get(
  "/courses/:courseId/assignments",
  authMiddleware,
  listCourseAssignments
);

// Instructor/admin assignment creation.
router.post(
  "/assignments",
  authMiddleware,
  requireRole("instructor", "admin"),
  createAssignment
);

// Student submission and submission history.
router.post(
  "/assignments/:id/submit",
  authMiddleware,
  requireRole("student"),
  submitAssignment
);

router.get(
  "/submissions/me",
  authMiddleware,
  requireRole("student"),
  getMySubmissions
);

// Instructor/admin grading.
router.put(
  "/submissions/:id/grade",
  authMiddleware,
  requireRole("instructor", "admin"),
  gradeSubmission
);

module.exports = router;
