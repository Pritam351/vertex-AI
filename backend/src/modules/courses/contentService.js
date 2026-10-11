
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

const listModules = async (courseId) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  });

  if (!course) fail(404, "Course not found");

  const modules = await CourseModule.find({ courseId })
    .sort({ orderIndex: 1 })
    .lean();

  const moduleIds = modules.map((item) => item._id);

  const lectures = await Lecture.find({
    moduleId: { $in: moduleIds },
  })
    .sort({ orderIndex: 1 })
    .select("-transcript")
    .lean();

  return modules.map((item) => ({
    ...item,
    lectures: lectures.filter(
      (lecture) => lecture.moduleId.toString() === item._id.toString()
    ),
  }));
};

const createLecture = async (moduleId, data, user) => {
  await getModuleForEditor(moduleId, user);

  const orderIndex =
    data.orderIndex ??
    ((await Lecture.countDocuments({ moduleId })) + 1);

  return Lecture.create({
    moduleId,
    title: data.title,
    videoUrl: data.videoUrl || "",
    transcript: data.transcript || "",
    durationSeconds: data.durationSeconds ?? 0,
    orderIndex,
    resourceUrls: data.resourceUrls || [],
  });
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
    .select("-transcript")
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
  createModule,
  listModules,
  createLecture,
  listLectures,
  getLectureForEditor,
};
