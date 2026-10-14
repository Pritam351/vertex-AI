
const mongoose = require("mongoose");

const Certificate = require("./certificateModel");
const Enrollment = require("../enrollments/enrollmentModel");
const Course = require("../courses/courseModel");
const CourseModule = require("../courses/moduleModel");
const Lecture = require("../courses/lectureModel");
const LectureProgress = require("../enrollments/lectureProgressModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const issueCertificate = async (courseId, user) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  });

  if (!course) {
    fail(404, "Approved course not found");
  }

  const enrollment = await Enrollment.findOne({
    userId: user._id,
    courseId: course._id,
  });

  if (!enrollment) {
    fail(403, "You must enroll in this course first");
  }

  const modules = await CourseModule.find({
    courseId: course._id,
  }).select("_id");

  const moduleIds = modules.map((module) => module._id);

  const lectures = moduleIds.length
    ? await Lecture.find({
        moduleId: { $in: moduleIds },
      }).select("_id")
    : [];

  if (lectures.length === 0) {
    fail(400, "This course has no lectures yet");
  }

  const lectureIds = lectures.map((lecture) => lecture._id);

  const completedCount = await LectureProgress.countDocuments({
    enrollmentId: enrollment._id,
    lectureId: { $in: lectureIds },
    completed: true,
  });

  if (completedCount < lectureIds.length) {
    fail(400, "Complete all course lectures before requesting a certificate");
  }

  const existing = await Certificate.findOne({
    userId: user._id,
    courseId: course._id,
  });

  if (existing) {
    return existing;
  }

  const certificateNumber = `VERTEX-${new mongoose.Types.ObjectId()
    .toString()
    .toUpperCase()}`;

  try {
    return await Certificate.create({
      userId: user._id,
      courseId: course._id,
      certificateNumber,
      studentName: user.fullName,
      courseTitle: course.title,
      issuedAt: new Date(),
    });
  } catch (error) {
    // Handle simultaneous requests for the same certificate.
    if (error.code === 11000) {
      const certificate = await Certificate.findOne({
        userId: user._id,
        courseId: course._id,
      });

      if (certificate) return certificate;
    }

    throw error;
  }
};

const getMyCertificates = async (userId) => {
  return Certificate.find({ userId })
    .sort({ issuedAt: -1 })
    .lean();
};

const verifyCertificate = async (certificateNumber) => {
  const certificate = await Certificate.findOne({
    certificateNumber,
  })
    .select("certificateNumber studentName courseTitle issuedAt")
    .lean();

  if (!certificate) {
    fail(404, "Certificate not found");
  }

  return certificate;
};

module.exports = {
  issueCertificate,
  getMyCertificates,
  verifyCertificate,
};
