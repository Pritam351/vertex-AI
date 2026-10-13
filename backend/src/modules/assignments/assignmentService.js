
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

  return Assignment.create({
    courseId: course._id,
    title: data.title,
    instructions: data.instructions,
    rubric: data.rubric || {},
    dueDate,
    createdBy: user._id,
  });
};

const listCourseAssignments = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");

  if (user.role === "student") {
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

  // Update the existing submission if the student submits again
  // before the deadline; otherwise create their first submission.
  const submission = await Submission.findOneAndUpdate(
    { assignmentId: assignment._id, userId: user._id },
    {
      $set: {
        fileUrl,
        submittedAt: new Date(),
        grade: null,
        feedback: "",
        gradedBy: null,
        gradedAt: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
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
  return submission;
};

const getMySubmissions = async (userId) => {
  return Submission.find({ userId })
    .populate("assignmentId", "title courseId dueDate")
    .sort({ submittedAt: -1 })
    .lean();
};

module.exports = {
  createAssignment,
  listCourseAssignments,
  submitAssignment,
  gradeSubmission,
  getMySubmissions,
};
