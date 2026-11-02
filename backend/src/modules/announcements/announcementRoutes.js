const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  createCourseAnnouncement,
  listCourseAnnouncements,
  listInstructorAnnouncements,
  removeAnnouncement,
  pinAnnouncement,
} = require("./announcementController");

const router = express.Router();

// List announcements for an instructor across all their courses
router.get(
  "/announcements/me",
  authMiddleware,
  requireRole("instructor", "admin"),
  listInstructorAnnouncements
);

// Create announcement for a specific course (auto-notifies all enrolled students)
router.post(
  "/courses/:courseId/announcements",
  authMiddleware,
  requireRole("instructor", "admin"),
  createCourseAnnouncement
);

// List announcements for a specific course
router.get(
  "/courses/:courseId/announcements",
  authMiddleware,
  requireRole("student", "instructor", "admin"),
  listCourseAnnouncements
);

// Delete an announcement
router.delete(
  "/announcements/:announcementId",
  authMiddleware,
  requireRole("instructor", "admin"),
  removeAnnouncement
);

// Toggle pin on an announcement
router.patch(
  "/announcements/:announcementId/pin",
  authMiddleware,
  requireRole("instructor", "admin"),
  pinAnnouncement
);

module.exports = router;

