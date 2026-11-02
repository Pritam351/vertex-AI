const mongoose = require("mongoose");
const Announcement = require("./announcementModel");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");
const { createBulkNotifications } = require("../notifications/notificationService");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const createAnnouncement = async (courseId, user, payload = {}) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const { title, content, isPinned = false } = payload;
  if (!title?.trim() || title.trim().length < 3) {
    fail(400, "Announcement title must be at least 3 characters");
  }
  if (!content?.trim() || content.trim().length < 5) {
    fail(400, "Announcement content must be at least 5 characters");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    fail(404, "Course not found");
  }

  // Only course instructor or admin can post announcements
  if (user.role !== "admin" && String(course.instructorId) !== String(user._id)) {
    fail(403, "Forbidden: Only the course instructor can post announcements for this course");
  }

  const announcement = await Announcement.create({
    courseId,
    instructorId: user._id,
    title: title.trim(),
    content: content.trim(),
    isPinned: Boolean(isPinned),
  });

  // Fetch all students enrolled in this course to notify them
  const enrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
  let notifiedCount = 0;

  if (enrollments.length > 0) {
    const studentNotifications = enrollments.map((enr) => ({
      userId: enr.userId,
      type: "announcement",
      title: `📢 Announcement: ${course.title}`,
      message: `${title.trim()}: ${content.trim().slice(0, 160)}${content.trim().length > 160 ? "..." : ""}`,
      link: `#/student/player?courseId=${course._id}&tab=announcements`,
    }));

    try {
      await createBulkNotifications(studentNotifications);
      notifiedCount = enrollments.length;
    } catch (notifErr) {
      console.error("[AnnouncementService] Bulk notification error:", notifErr.message);
    }
  }

  const populated = await Announcement.findById(announcement._id)
    .populate("instructorId", "name email")
    .lean();

  return {
    ...populated,
    notifiedCount,
  };
};

const getCourseAnnouncements = async (courseId, user) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId).select("title instructorId status").lean();
  if (!course) {
    fail(404, "Course not found");
  }

  // Authorization: Enrolled student, course instructor, or admin
  if (user.role === "student") {
    const enrolled = await Enrollment.findOne({ courseId, userId: user._id }).lean();
    if (!enrolled && course.status !== "approved") {
      fail(403, "You must be enrolled in this course to view announcements");
    }
  } else if (user.role === "instructor" && String(course.instructorId) !== String(user._id)) {
    fail(403, "You do not have access to view this course's announcements");
  }

  const announcements = await Announcement.find({ courseId })
    .populate("instructorId", "name email")
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();

  return announcements;
};

const getInstructorAnnouncements = async (user) => {
  const query = user.role === "admin" ? {} : { instructorId: user._id };

  const announcements = await Announcement.find(query)
    .populate("courseId", "title thumbnailUrl category")
    .populate("instructorId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return announcements;
};

const deleteAnnouncement = async (announcementId, user) => {
  if (!mongoose.isValidObjectId(announcementId)) {
    fail(400, "Invalid announcement ID");
  }

  const announcement = await Announcement.findById(announcementId);
  if (!announcement) {
    fail(404, "Announcement not found");
  }

  if (user.role !== "admin" && String(announcement.instructorId) !== String(user._id)) {
    fail(403, "Forbidden: You can only delete your own announcements");
  }

  await Announcement.findByIdAndDelete(announcementId);
  return { id: announcementId };
};

const togglePinAnnouncement = async (announcementId, user) => {
  if (!mongoose.isValidObjectId(announcementId)) {
    fail(400, "Invalid announcement ID");
  }

  const announcement = await Announcement.findById(announcementId);
  if (!announcement) {
    fail(404, "Announcement not found");
  }

  if (user.role !== "admin" && String(announcement.instructorId) !== String(user._id)) {
    fail(403, "Forbidden: You can only pin/unpin your own announcements");
  }

  announcement.isPinned = !announcement.isPinned;
  await announcement.save();

  return announcement;
};

module.exports = {
  createAnnouncement,
  getCourseAnnouncements,
  getInstructorAnnouncements,
  deleteAnnouncement,
  togglePinAnnouncement,
};

