const mongoose = require("mongoose");

const Assignment = require("./assignmentModel");
const Submission = require("./submissionModel");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validId = (id) => mongoose.isValidObjectId(id);

const getAssignment = async (id) => {
  if (!validId(id)) fail(400, "Invalid assignment ID");

  const assignment = await Assignment.findById(id);
  if (!assignment) fail(404, "Assignment not found");

  return assignment;
};

const createAssignment = async (data, user) => {
  if (!validId(data.courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(data.courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot create assignments for another instructor's course");
  }

  const dueDate = new Date(data.dueDate);
  if (Number.isNaN(dueDate.getTime())) fail(400, "Invalid due date");
  if (dueDate <= new Date()) fail(400, "Due date must be in the future");

  const assignment = await Assignment.create({
    courseId: course._id,
    title: data.title,
    instructions: data.instructions,
    rubric: data.rubric || {},
    dueDate,
    createdBy: user._id,
  });

  // Notify students enrolled in this course
  try {
    const { createBulkNotifications } = require("../notifications/notificationService");
    const enrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
    if (enrollments.length > 0) {
      await createBulkNotifications(
        enrollments.map((e) => ({
          userId: e.userId,
          type: "assignment",
          title: `New Assignment: ${data.title}`,
          message: `A new assignment "${data.title}" was posted for "${course.title}". Due: ${dueDate.toLocaleDateString()}.`,
          link: "#/student/quizzes",
        }))
      );
    }
  } catch (_) {}

  return assignment;
};

const listCourseAssignments = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (user.role === "student") {
    if (course.status !== "approved") fail(404, "Course not found");

    const enrolled = await Enrollment.exists({
      userId: user._id,
      courseId: course._id,
    });

    if (!enrolled) fail(403, "Enroll in this course first");
  } else if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot view assignments for another instructor's course");
  }

  return Assignment.find({ courseId: course._id })
    .sort({ dueDate: 1 })
    .lean();
};

const submitAssignment = async (assignmentId, fileUrl, user) => {
  const assignment = await getAssignment(assignmentId);

  if (assignment.dueDate <= new Date()) {
    fail(400, "Assignment deadline has passed");
  }

  const course = await Course.findOne({
    _id: assignment.courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");

  const enrolled = await Enrollment.exists({
    userId: user._id,
    courseId: assignment.courseId,
  });

  if (!enrolled) fail(403, "Enroll in this course before submitting");

  const submission = await Submission.findOneAndUpdate(
    { assignmentId: assignment._id, userId: user._id },
    {
      $set: {
        fileUrl,
        submittedAt: new Date(),
        grade: null,
        feedback: null,
        gradedBy: null,
        gradedAt: null,
      },
    },
    { new: true, runValidators: true }
  );

  if (submission) return submission;

  try {
    return await Submission.create({
      assignmentId: assignment._id,
      userId: user._id,
      fileUrl,
    });
  } catch (error) {
    if (error.code === 11000) {
      fail(409, "Submission already exists; please try again");
    }
    throw error;
  }
};

const gradeSubmission = async (submissionId, data, user) => {
  if (!validId(submissionId)) fail(400, "Invalid submission ID");

  const submission = await Submission.findById(submissionId);
  if (!submission) fail(404, "Submission not found");

  const assignment = await getAssignment(submission.assignmentId);
  const course = await Course.findById(assignment.courseId);

  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot grade submissions for another instructor's course");
  }

  submission.grade = data.grade;
  submission.feedback = data.feedback || "";
  submission.gradedBy = user._id;
  submission.gradedAt = new Date();

  await submission.save();

  // Notify student of graded assignment
  try {
    const { createNotification } = require("../notifications/notificationService");
    await createNotification({
      userId: submission.userId,
      type: "grade",
      title: `Assignment Graded: ${assignment.title}`,
      message: `Your submission for "${assignment.title}" has been graded: ${data.grade}/100.`,
      link: "#/student/quizzes",
    });
  } catch (_) {}

  return Submission.findById(submission._id)
    .populate("userId", "fullName email")
    .populate("assignmentId", "title dueDate")
    .lean();
};

const getMySubmissions = async (userId) => {
  return Submission.find({ userId })
    .populate({
      path: "assignmentId",
      select: "title courseId dueDate maxScore instructions",
      populate: { path: "courseId", select: "title category" },
    })
    .sort({ submittedAt: -1 })
    .lean();
};

const listCourseSubmissions = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot view submissions for another instructor's course");
  }

  const assignments = await Assignment.find({ courseId })
    .select("_id title dueDate")
    .lean();
  const assignmentIds = assignments.map((a) => a._id);

  return Submission.find({ assignmentId: { $in: assignmentIds } })
    .populate("userId", "fullName email")
    .populate("assignmentId", "title dueDate")
    .sort({ submittedAt: -1 })
    .lean();
};

module.exports = {
  createAssignment,
  listCourseAssignments,
  submitAssignment,
  gradeSubmission,
  getMySubmissions,
  listCourseSubmissions,
};
