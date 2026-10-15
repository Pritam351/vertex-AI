
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  testGemini,
  ingestLectureTranscript,
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

module.exports = router;
