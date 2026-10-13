
const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  saveNote,
  getNote,
  addBookmark,
  removeBookmark,
  getMyBookmarks,
} = require("./learningController");

const router = express.Router();

// Student-only middleware is applied PER ROUTE (not router.use), because this router
// is mounted at "/api/v1" and router.use would run for EVERY /api/v1/* request.
const studentOnly = [authMiddleware, requireRole("student")];

// Lecture notes
router.put("/lectures/:lectureId/notes", ...studentOnly, saveNote);
router.get("/lectures/:lectureId/notes",...studentOnly, getNote);

// Lecture bookmarks
router.post("/lectures/:lectureId/bookmarks", ...studentOnly, addBookmark);
router.delete("/lectures/:lectureId/bookmarks", ...studentOnly, removeBookmark);
router.get("/bookmarks/me",...studentOnly, getMyBookmarks);

module.exports = router;
