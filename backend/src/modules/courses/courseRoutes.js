const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");
const optionalAuthMiddleware = require("../../middleware/optionalAuthMiddleware");

const {
  createCourse,
  listCourses,
  listMyCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCourseAnalytics,
  getMyCoursesAnalytics,
} = require("./courseController");

const router = express.Router();

// Public catalog
router.get("/", listCourses);

router.get(
  "/mine",
  authMiddleware,
  requireRole("instructor", "admin"),
  listMyCourses
);

router.get(
  "/mine/analytics",
  authMiddleware,
  requireRole("instructor", "admin"),
  getMyCoursesAnalytics
);

router.get(
  "/:id/analytics",
  authMiddleware,
  requireRole("instructor", "admin"),
  getCourseAnalytics
);

router.get("/:id", optionalAuthMiddleware, getCourseById);

// Instructor/admin actions
router.post(
  "/",
  authMiddleware,
  requireRole("instructor"),
  createCourse
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("instructor", "admin"),
  updateCourse
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("instructor", "admin"),
  deleteCourse
);

module.exports = router;