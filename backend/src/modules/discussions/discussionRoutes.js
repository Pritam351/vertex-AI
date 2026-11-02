const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createDiscussionThread,
  getCourseThreads,
  createReply,
  moderateThread,
  getModerationQueue,
} = require("./discussionController");

const router = express.Router();

// List discussions for an approved course
router.get(
  "/courses/:courseId/discussions",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  getCourseThreads
);

// Create a discussion thread
router.post(
  "/discussions",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  createDiscussionThread
);

// Reply to a thread
router.post(
  "/discussions/:threadId/replies",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  createReply
);

// Moderate or report (flag) a thread or a reply
router.patch(
  "/discussions/:threadId/moderation",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  moderateThread
);

// Admin & Instructor Moderation Queue (flagged/hidden threads across courses)
router.get(
  "/discussions/moderation",
  authMiddleware,
  requireRole("instructor", "admin"),
  getModerationQueue
);

module.exports = router;
