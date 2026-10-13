
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

// All learning routes require a logged-in student.
router.use(authMiddleware, requireRole("student"));

// Lecture notes
router.put("/lectures/:lectureId/notes", saveNote);
router.get("/lectures/:lectureId/notes", getNote);

// Lecture bookmarks
router.post("/lectures/:lectureId/bookmarks", addBookmark);
router.delete("/lectures/:lectureId/bookmarks", removeBookmark);
router.get("/bookmarks/me", getMyBookmarks);

module.exports = router;
