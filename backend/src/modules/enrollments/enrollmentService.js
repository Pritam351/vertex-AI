
const mongoose = require("mongoose");
const Course = require("../courses/courseModel");
const CourseModule = require("../courses/moduleModel");
const Lecture = require("../courses/lectureModel");
const Enrollment = require("./enrollmentModel");
const LectureProgress = require("./lectureProgressModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validId = (id) => mongoose.isValidObjectId(id);

const enrollInCourse = async (courseId, userId) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");

  try {
    return await Enrollment.create({ userId, courseId });
  } catch (error) {
    if (error.code === 11000) {
      fail(409, "You are already enrolled in this course");
    }
    throw error;
  }
};

const getMyEnrollments = async (userId) => {
  const enrollments = await Enrollment.find({ userId })
    .populate({
      path: "courseId",
      select: "title description category difficulty thumbnailUrl status",
    })
    .sort({ enrolledAt: -1 })
    .lean();

  return enrollments.filter(
    (enrollment) => enrollment.courseId?.status === "approved"
  );
};

const updateLectureProgress = async (
  lectureId,
  userId,
  data
) => {
  if (!validId(lectureId)) fail(400, "Invalid lecture ID");

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) fail(404, "Lecture not found");

  const module = await CourseModule.findOne({
    _id: lecture.moduleId,
  });

  if (!module) fail(404, "Module not found");

  const course = await Course.findOne({
    _id: module.courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");

  const enrollment = await Enrollment.findOne({
    userId,
    courseId: course._id,
  });

  if (!enrollment) {
    fail(403, "Enroll in this course before updating progress");
  }

  const filter = {
    enrollmentId: enrollment._id,
    lectureId: lecture._id,
  };

  const existing = await LectureProgress.findOne(filter);

  const watchedSeconds = Math.max(
    existing?.watchedSeconds || 0,
    data.watchedSeconds
  );

  const completed = Boolean(existing?.completed || data.completed);

  await LectureProgress.findOneAndUpdate(
    filter,
    {
      $set: {
        watchedSeconds,
        completed,
        lastWatchedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Calculate progress from the lectures currently in the course.
  const moduleIds = await CourseModule.find({ courseId: course._id })
    .distinct("_id");

  const lectureIds = await Lecture.find({
    moduleId: { $in: moduleIds },
  }).distinct("_id");

  const totalLectures = lectureIds.length;

  const completedCount = totalLectures === 0
    ? 0
    : await LectureProgress.countDocuments({
        enrollmentId: enrollment._id,
        lectureId: { $in: lectureIds },
        completed: true,
      });

  enrollment.progressPercent = totalLectures === 0
    ? 0
    : Math.round((completedCount / totalLectures) * 10000) / 100;

  await enrollment.save();

  return {
    lectureId: lecture._id,
    watchedSeconds,
    completed,
    progressPercent: enrollment.progressPercent,
    completedLectures: completedCount,
    totalLectures,
  };
};

const getCourseEnrollments = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot view enrollments for another instructor's course");
  }

  return Enrollment.find({ courseId })
    .populate("userId", "fullName email avatarUrl")
    .sort({ enrolledAt: -1 })
    .lean();
};

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  updateLectureProgress,
  getCourseEnrollments,
};
