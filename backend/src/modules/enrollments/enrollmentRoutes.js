
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  enroll,
  getMyEnrollments,
  updateProgress,
} = require("./enrollmentController");

const router = express.Router();

// All endpoints require an authenticated student.
router.use(authMiddleware, requireRole("student"));

router.post("/courses/:id/enroll", enroll);
router.get("/enrollments/me", getMyEnrollments);
router.post("/lectures/:id/progress", updateProgress);

module.exports = router;
