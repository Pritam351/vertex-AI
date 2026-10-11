
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  getPendingCourses,
  reviewCourse,
} = require("./adminController");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/courses/pending", getPendingCourses);
router.post("/courses/:id/approve", reviewCourse);

module.exports = router;
