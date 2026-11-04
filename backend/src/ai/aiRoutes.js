
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { aiLimiter } = require("../middleware/rateLimitMiddleware");

const {
  testGemini,
  ingestLectureTranscript,
  embedLectureTranscript,
  retrieveCourseContext,
  summarizeLecture,
  generateLectureQuiz,
  generateModuleFlashcards,
  getMyFlashcardSets,
  getFlashcardSet,
} = require("./aiController");

const {
  sendChatMessage,
  getCourseChatHistory,
  getChatSession,
} = require("./chatController");

const { 
  createStudyPlan,
} = require("./studyPlanController");

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
  aiLimiter,
  authMiddleware,
  requireRole("student"),
  retrieveCourseContext
);

// AI tutor chat: send a question and save the response.
router.post(
  "/courses/:courseId/chat",
  aiLimiter,
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

router.post(
  "/lectures/:lectureId/summarize",
  aiLimiter,
  authMiddleware,
  requireRole("student", "admin"),
  summarizeLecture
);


router.post(
  "/lectures/:lectureId/generate-quiz",
  aiLimiter,
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  generateLectureQuiz
);

router.post(
  "/modules/:moduleId/flashcards",
  aiLimiter,
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  generateModuleFlashcards
);

router.get(
  "/flashcards/me",
  authMiddleware,
  requireRole("student"),
  getMyFlashcardSets
);

router.get(
  "/flashcards/:setId",
  authMiddleware,
  requireRole("student"),
  getFlashcardSet
);

// Personalized study plan, mastery, and recommendations.
router.post(
  "/study-plan",
  aiLimiter,
  authMiddleware,
  requireRole("student"),
  createStudyPlan
);

module.exports = router;
