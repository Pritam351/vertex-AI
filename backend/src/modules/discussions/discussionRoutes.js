
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createDiscussionThread,
  getCourseThreads,
  createReply,
  moderateThread,
} = require("./discussionController");

const router = express.Router();

// List discussions for an approved course.
router.get(
  "/courses/:courseId/discussions",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  getCourseThreads
);

// Create a discussion thread.
router.post(
  "/discussions",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  createDiscussionThread
);

// Reply to a thread.
router.post(
  "/discussions/:threadId/replies",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  createReply
);

// Moderate a thread or a reply.
router.patch(
  "/discussions/:threadId/moderation",
  authMiddleware,
  requireRole("instructor", "admin"),
  moderateThread
);

module.exports = router;
