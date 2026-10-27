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
} = require("./courseController");

const router = express.Router();

// Public catalog
router.get("/", listCourses);

router.get(
  "/mine",
  authMiddleware,
  requireRole("instructor"),
  listMyCourses
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