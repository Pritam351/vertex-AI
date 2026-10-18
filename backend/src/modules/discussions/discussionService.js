
const mongoose = require("mongoose");
const DiscussionThread = require("./discussionModel");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const isAdmin = (user) => user.role === "admin";

const getCourse = async (courseId) => {
  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  });

  if (!course) fail(404, "Approved course not found");
  return course;
};

const canManageCourse = (course, user) =>
  isAdmin(user) ||
  (user.role === "instructor" &&
    course.instructorId.toString() === user._id.toString());

const ensureCourseAccess = async (course, user) => {
  if (canManageCourse(course, user)) return;

  if (user.role !== "student") {
    fail(403, "You cannot access this course discussion");
  }

  const enrolled = await Enrollment.exists({
    userId: user._id,
    courseId: course._id,
  });

  if (!enrolled) fail(403, "Enroll in this course first");
};

const getThread = async (threadId) => {
  if (!mongoose.isValidObjectId(threadId)) {
    fail(400, "Invalid discussion thread ID");
  }

  const thread = await DiscussionThread.findById(threadId);

  if (!thread) fail(404, "Discussion thread not found");
  return thread;
};

const createThread = async (data, user) => {
  const course = await getCourse(data.courseId);
  await ensureCourseAccess(course, user);

  return DiscussionThread.create({
    courseId: course._id,
    createdBy: user._id,
    title: data.title,
    content: data.content,
  });
};

const listThreads = async (courseId, user) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const course = await getCourse(courseId);
  await ensureCourseAccess(course, user);

  const query = { courseId: course._id };

  if (user.role === "student") {
    query.isHidden = false;
  }

  const threads = await DiscussionThread.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return threads.map((thread) => {
    const visiblePosts =
      user.role === "student"
        ? thread.posts.filter((post) => !post.isHidden)
        : thread.posts;

    return {
      ...thread,
      posts: visiblePosts,
    };
  });
};

const replyToThread = async (threadId, data, user) => {
  const thread = await getThread(threadId);
  const course = await getCourse(thread.courseId);
  await ensureCourseAccess(course, user);

  if (thread.isHidden) fail(404, "Discussion thread not found");
  if (thread.isLocked) fail(403, "This discussion thread is locked");

  if (data.parentPostId) {
    const parentExists = thread.posts.some(
      (post) => post._id.toString() === data.parentPostId
    );

    if (!parentExists) {
      fail(404, "Parent reply not found in this thread");
    }
  }

  thread.posts.push({
    userId: user._id,
    content: data.content,
    parentPostId: data.parentPostId,
  });

  await thread.save();
  return thread;
};

const moderateDiscussion = async (threadId, data, user) => {
  const thread = await getThread(threadId);
  const course = await getCourse(thread.courseId);

  if (!canManageCourse(course, user)) {
    fail(403, "Only the course instructor or an admin can moderate");
  }

  const now = new Date();

  if (data.target === "thread") {
    switch (data.action) {
      case "hide":
        thread.isHidden = true;
        break;
      case "unhide":
        thread.isHidden = false;
        break;
      case "lock":
        thread.isLocked = true;
        break;
      case "unlock":
        thread.isLocked = false;
        break;
      default:
        fail(400, "This action is not supported for threads");
    }

    thread.moderatedBy = user._id;
    thread.moderatedAt = now;
    await thread.save();

    return thread;
  }

  if (data.target !== "post") {
    fail(400, "Target must be thread or post");
  }

  if (!data.postId || !mongoose.isValidObjectId(data.postId)) {
    fail(400, "A valid postId is required");
  }

  const post = thread.posts.id(data.postId);

  if (!post) fail(404, "Discussion reply not found");

  switch (data.action) {
    case "hide":
      post.isHidden = true;
      break;
    case "unhide":
      post.isHidden = false;
      break;
    case "flag":
      post.isFlagged = true;
      break;
    case "unflag":
      post.isFlagged = false;
      break;
    default:
      fail(400, "This action is not supported for posts");
  }

  post.moderatedBy = user._id;
  post.moderatedAt = now;

  await thread.save();
  return thread;
};

module.exports = {
  createThread,
  listThreads,
  replyToThread,
  moderateDiscussion,
};
