
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  getPendingCourses,
  reviewCourse,
  getAllUsers,
  updateUserStatus,
} = require("./adminController");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/courses/pending", getPendingCourses);
router.post("/courses/:id/approve", reviewCourse);

router.get("/users", getAllUsers);
router.patch("/users/:id/status", updateUserStatus);

module.exports = router;
