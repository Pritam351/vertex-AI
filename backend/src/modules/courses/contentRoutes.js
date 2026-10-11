
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createModule,
  listModules,
  createLecture,
  listLectures,
} = require("./contentController");

const router = express.Router();

// Public reading routes only expose content from approved courses.
router.get("/courses/:courseId/modules", listModules);
router.get("/modules/:moduleId/lectures", listLectures);

// Instructor/admin content authoring.
router.post(
  "/courses/:courseId/modules",
  authMiddleware,
  requireRole("instructor", "admin"),
  createModule
);

router.post(
  "/modules/:moduleId/lectures",
  authMiddleware,
  requireRole("instructor", "admin"),
  createLecture
);

module.exports = router;
