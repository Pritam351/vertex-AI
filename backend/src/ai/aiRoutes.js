
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  testGemini,
  ingestLectureTranscript,
  embedLectureTranscript,
} = require("./aiController");

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

module.exports = router;
