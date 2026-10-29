const mongoose = require("mongoose");
const Course = require("./courseModel");
const CourseModule = require("./moduleModel");
const Lecture = require("./lectureModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validId = (id) => mongoose.isValidObjectId(id);

const getCourseForEditor = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot edit another instructor's course");
  }

  return course;
};

const getModuleForEditor = async (moduleId, user) => {
  if (!validId(moduleId)) fail(400, "Invalid module ID");

  const module = await CourseModule.findById(moduleId);
  if (!module) fail(404, "Module not found");

  await getCourseForEditor(module.courseId, user);
  return module;
};

const createModule = async (courseId, data, user) => {
  await getCourseForEditor(courseId, user);

  const orderIndex =
    data.orderIndex ??
    ((await CourseModule.countDocuments({ courseId })) + 1);

  return CourseModule.create({
    courseId,
    title: data.title,
    orderIndex,
  });
};

const listModules = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (course.status !== "approved") {
    if (
      !user ||
      (user.role !== "admin" &&
        course.instructorId.toString() !== user._id.toString())
    ) {
      fail(404, "Course not found");
    }
  }

  const modules = await CourseModule.find({ courseId })
    .sort({ orderIndex: 1 })
    .lean();

  const moduleIds = modules.map((item) => item._id);

  const lectures = await Lecture.find({
    moduleId: { $in: moduleIds },
  })
    .sort({ orderIndex: 1 })
    .lean();

  return modules.map((item) => ({
    ...item,
    lectures: lectures.filter(
      (lecture) => lecture.moduleId.toString() === item._id.toString()
    ),
  }));
};

const updateModule = async (moduleId, data, user) => {
  const module = await getModuleForEditor(moduleId, user);

  if (data.title !== undefined) {
    module.title = data.title;
  }
  if (data.orderIndex !== undefined) {
    module.orderIndex = data.orderIndex;
  }

  await module.save();
  return module;
};

const deleteModule = async (moduleId, user) => {
  const module = await getModuleForEditor(moduleId, user);

  await Lecture.deleteMany({ moduleId: module._id });
  await module.deleteOne();

  return { success: true };
};

const createLecture = async (moduleId, data, user) => {
  const module = await getModuleForEditor(moduleId, user);

  const orderIndex =
    data.orderIndex ??
    ((await Lecture.countDocuments({ moduleId })) + 1);

  const lecture = await Lecture.create({
    moduleId,
    title: data.title,
    videoUrl: data.videoUrl || "",
    transcript: data.transcript || "",
    durationSeconds: data.durationSeconds ?? 0,
    orderIndex,
    resourceUrls: data.resourceUrls || [],
  });

  // Notify students enrolled in this course
  try {
    const Enrollment = require("../enrollments/enrollmentModel");
    const { createBulkNotifications } = require("../notifications/notificationService");

    const course = await Course.findById(module.courseId).select("title");
    const courseTitle = course?.title || "your course";

    const enrollments = await Enrollment.find({ courseId: module.courseId }).select("userId").lean();
    if (enrollments.length > 0) {
      await createBulkNotifications(
        enrollments.map((e) => ({
          userId: e.userId,
          type: "announcement",
          title: `New Lecture: ${data.title}`,
          message: `A new lecture "${data.title}" was added to "${courseTitle}". Check it out in the course player!`,
          link: `#/student/player?courseId=${module.courseId}`,
        }))
      );
    }
  } catch (_) {}

  return lecture;
};

const updateLecture = async (lectureId, data, user) => {
  const lecture = await getLectureForEditor(lectureId, user);

  if (data.title !== undefined) lecture.title = data.title;
  if (data.videoUrl !== undefined) lecture.videoUrl = data.videoUrl;
  if (data.transcript !== undefined) lecture.transcript = data.transcript;
  if (data.durationSeconds !== undefined) lecture.durationSeconds = data.durationSeconds;
  if (data.orderIndex !== undefined) lecture.orderIndex = data.orderIndex;
  if (data.resourceUrls !== undefined) lecture.resourceUrls = data.resourceUrls;

  await lecture.save();
  return lecture;
};

const deleteLecture = async (lectureId, user) => {
  const lecture = await getLectureForEditor(lectureId, user);
  await lecture.deleteOne();
  return { success: true };
};

const listLectures = async (moduleId) => {
  if (!validId(moduleId)) fail(400, "Invalid module ID");

  const module = await CourseModule.findById(moduleId);
  if (!module) fail(404, "Module not found");

  const course = await Course.findOne({
    _id: module.courseId,
    status: "approved",
  });

  if (!course) fail(404, "Course not found");

  return Lecture.find({ moduleId })
    .sort({ orderIndex: 1 })
    .lean();
};

const getLectureForEditor = async (lectureId, user) => {
  if (!validId(lectureId)) fail(400, "Invalid lecture ID");

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) fail(404, "Lecture not found");

  await getModuleForEditor(lecture.moduleId, user);
  return lecture;
};

module.exports = {
  getCourseForEditor,
  getModuleForEditor,
  getLectureForEditor,
  createModule,
  updateModule,
  deleteModule,
  listModules,
  createLecture,
  updateLecture,
  deleteLecture,
  listLectures,
};
