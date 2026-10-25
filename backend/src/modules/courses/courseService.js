const mongoose = require("mongoose");
const Course = require("./courseModel");

const createCourse = async (data, user) => {
  return Course.create({
    ...data,
    instructorId: user._id,
    status: "pending",
  });
};

const listCourses = async (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 12;

  const filter = { status: "approved" };

  if (query.category) filter.category = query.category;
  if (query.difficulty) filter.difficulty = query.difficulty;

  if (query.q && query.q.trim()) {
    filter.$or = [
      { title: { $regex: escapeRegex(query.q.trim()), $options: "i" } },
      { description: { $regex: escapeRegex(query.q.trim()), $options: "i" } },
    ];
  }

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("instructorId", "fullName"),
    Course.countDocuments(filter),
  ]);

  return {
    courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const listInstructorCourses = async (user) => {
  const Course = require("./courseModel");

  return Course.find({ instructorId: user._id })
    .select("-__v")
    .sort({ updatedAt: -1 })
    .lean();
};


const getCourseById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error("Invalid course ID");
    error.statusCode = 400;
    throw error;
  }

  const course = await Course.findOne({
    _id: id,
    status: "approved",
  }).populate("instructorId", "fullName");

  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  return course;
};

const updateCourse = async (id, data, user) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error("Invalid course ID");
    error.statusCode = 400;
    throw error;
  }

  const course = await Course.findById(id);

  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    const error = new Error("You cannot modify another instructor's course");
    error.statusCode = 403;
    throw error;
  }

  // Approval status is managed separately by admins.
  const { status, instructorId, ...safeUpdates } = data;

  Object.assign(course, safeUpdates);
  await course.save();

  return course;
};

const deleteCourse = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error("Invalid course ID");
    error.statusCode = 400;
    throw error;
  }

  const course = await Course.findById(id);

  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    const error = new Error("You cannot delete another instructor's course");
    error.statusCode = 403;
    throw error;
  }

  await course.deleteOne();
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createCourse,
  listCourses,
  listInstructorCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};