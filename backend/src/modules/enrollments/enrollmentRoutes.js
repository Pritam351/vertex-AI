
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  enroll,
  getMyEnrollments,
  updateProgress,
  getCourseEnrollments,
} = require("./enrollmentController");

const router = express.Router();

// Student-only middleware is applied PER ROUTE (not router.use), because this router
// is mounted at "/api/v1" and router.use would run for EVERY /api/v1/* request.
const studentOnly = [authMiddleware, requireRole("student")];

router.post("/courses/:id/enroll", ...studentOnly, enroll);
router.get("/enrollments/me", ...studentOnly, getMyEnrollments);
router.post("/lectures/:id/progress", ...studentOnly, updateProgress);

// Instructor/admin route to view enrolled students per course.
router.get(
  "/courses/:id/enrollments",
  authMiddleware,
  requireRole("instructor", "admin"),
  getCourseEnrollments
);

module.exports = router;
