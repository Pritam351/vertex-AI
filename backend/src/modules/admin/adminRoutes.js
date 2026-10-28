
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  getDashboardStats,
  getPendingCourses,
  getPublishedCourses,
  getArchivedCourses,
  toggleCoursePublish,
  reviewCourse,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
} = require("./adminController");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

// Dashboard
router.get("/stats", getDashboardStats);

// Course management
router.get("/courses/pending", getPendingCourses);
router.get("/courses/published", getPublishedCourses);
router.get("/courses/archived", getArchivedCourses);
router.post("/courses/:id/approve", reviewCourse);
router.patch("/courses/:id/publish", toggleCoursePublish);

// User management
router.get("/users", getAllUsers);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/role", updateUserRole);

module.exports = router;
