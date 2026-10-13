
const mongoose = require("mongoose");

const Course = require("../courses/courseModel");
const CourseModule = require("../courses/moduleModel");
const Lecture = require("../courses/lectureModel");
const Enrollment = require("./enrollmentModel");

const LectureNote = require("./lectureNoteModel");
const LectureBookmark = require("./lectureBookmarkModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validId = (id) => mongoose.isValidObjectId(id);

// Verify the lecture belongs to an approved course
// and the student is enrolled in that course.
const getEnrolledLecture = async (lectureId, userId) => {
  if (!validId(lectureId)) {
    fail(400, "Invalid lecture ID");
  }

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) fail(404, "Lecture not found");

  const courseModule = await CourseModule.findById(lecture.moduleId);
  if (!courseModule) fail(404, "Module not found");

  const course = await Course.findOne({
    _id: courseModule.courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");

  const enrollment = await Enrollment.findOne({
    userId,
    courseId: course._id,
  });

  if (!enrollment) {
    fail(403, "Enroll in this course first");
  }

  return lecture;
};

// Create or update a student's note for a lecture.
const saveNote = async (lectureId, userId, content) => {
  await getEnrolledLecture(lectureId, userId);

  return LectureNote.findOneAndUpdate(
    { userId, lectureId },
    { $set: { content } },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
};

// Retrieve the student's note for a lecture.
const getNote = async (lectureId, userId) => {
  await getEnrolledLecture(lectureId, userId);

  return LectureNote.findOne({ userId, lectureId }).lean();
};

// Bookmark a lecture without creating duplicates.
const addBookmark = async (lectureId, userId) => {
  await getEnrolledLecture(lectureId, userId);

  try {
    return await LectureBookmark.create({ userId, lectureId });
  } catch (error) {
    if (error.code === 11000) {
      return LectureBookmark.findOne({ userId, lectureId });
    }
    throw error;
  }
};

// Remove a bookmark belonging to the current student.
const removeBookmark = async (lectureId, userId) => {
  await getEnrolledLecture(lectureId, userId);

  await LectureBookmark.findOneAndDelete({ userId, lectureId });

  return { lectureId };
};

// List the current student's bookmarked lectures.
const getMyBookmarks = async (userId) => {
  const bookmarks = await LectureBookmark.find({ userId })
    .sort({ createdAt: -1 })
    .lean();

  const results = [];

  for (const bookmark of bookmarks) {
    const lecture = await Lecture.findById(bookmark.lectureId).lean();
    if (!lecture) continue;

    const courseModule = await CourseModule.findById(
      lecture.moduleId
    ).lean();
    if (!courseModule) continue;

    const course = await Course.findOne({
      _id: courseModule.courseId,
      status: "approved",
    })
      .select("title")
      .lean();

    if (!course) continue;

    const enrollment = await Enrollment.exists({
      userId,
      courseId: courseModule.courseId,
    });

    if (!enrollment) continue;

    results.push({
      ...bookmark,
      lecture,
      course: {
        _id: courseModule.courseId,
        title: course.title,
      },
      module: {
        _id: courseModule._id,
        title: courseModule.title,
      },
    });
  }

  return results;
};

module.exports = {
  saveNote,
  getNote,
  addBookmark,
  removeBookmark,
  getMyBookmarks,
};
