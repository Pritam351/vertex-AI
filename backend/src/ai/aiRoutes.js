
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  testGemini,
  ingestLectureTranscript,
  embedLectureTranscript,
  retrieveCourseContext,
} = require("./aiController");

const {
  sendChatMessage,
  getCourseChatHistory,
  getChatSession,
} = require("./chatController");

const router = express.Router();

// Temporary Gemini connection test.
router.post("/test", testGemini);

// Ingest a lecture transcript.
// Only the owning instructor or an admin can ingest it.
router.post(
  "/lectures/:lectureId/ingest",
  authMiddleware,
  requireRole("instructor", "admin"),
  ingestLectureTranscript
);

router.post(
  "/lectures/:lectureId/embed",
  authMiddleware,
  requireRole("instructor", "admin"),
  embedLectureTranscript
);

router.post(
  "/courses/:courseId/retrieve",
  authMiddleware,
  requireRole("student"),
  retrieveCourseContext
);

// AI tutor chat: send a question and save the response.
router.post(
  "/courses/:courseId/chat",
  authMiddleware,
  requireRole("student", "admin"),
  sendChatMessage
);

// List the current user's chat sessions for a course.
router.get(
  "/courses/:courseId/chats",
  authMiddleware,
  requireRole("student", "admin"),
  getCourseChatHistory
);

// Reopen one of the current user's conversations.
router.get(
  "/chats/:sessionId",
  authMiddleware,
  requireRole("student", "admin"),
  getChatSession
);

module.exports = router;
