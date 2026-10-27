
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const optionalAuthMiddleware = require("../../middleware/optionalAuthMiddleware");

const {
  createModule,
  updateModule,
  deleteModule,
  listModules,
  createLecture,
  updateLecture,
  deleteLecture,
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

router.put(
  "/modules/:moduleId",
  authMiddleware,
  requireRole("instructor", "admin"),
  updateModule
);

router.delete(
  "/modules/:moduleId",
  authMiddleware,
  requireRole("instructor", "admin"),
  deleteModule
);

router.post(
  "/modules/:moduleId/lectures",
  authMiddleware,
  requireRole("instructor", "admin"),
  createLecture
);

router.put(
  "/lectures/:lectureId",
  authMiddleware,
  requireRole("instructor", "admin"),
  updateLecture
);

router.delete(
  "/lectures/:lectureId",
  authMiddleware,
  requireRole("instructor", "admin"),
  deleteLecture
);

module.exports = router;
