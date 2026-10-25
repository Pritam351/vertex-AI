
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const optionalAuthMiddleware = require("../../middleware/optionalAuthMiddleware");

const {
  createModule,
  listModules,
  createLecture,
  listLectures,
} = require("./contentController");

const router = express.Router();

// Reading routes: public for approved courses; also accessible to course owner/admin.
router.get("/courses/:courseId/modules", optionalAuthMiddleware, listModules);
router.get("/modules/:moduleId/lectures", optionalAuthMiddleware, listLectures);

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
