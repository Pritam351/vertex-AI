
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  getDashboardStats,
  getPendingCourses,
  reviewCourse,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
} = require("./adminController");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/stats", getDashboardStats);
router.get("/courses/pending", getPendingCourses);
router.post("/courses/:id/approve", reviewCourse);

router.get("/users", getAllUsers);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/role", updateUserRole);

module.exports = router;
