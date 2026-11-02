const mongoose = require("mongoose");
const DiscussionThread = require("./discussionModel");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");
const User = require("../users/userModel");
const { createNotification } = require("../notifications/notificationService");

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

  const thread = await DiscussionThread.create({
    courseId: course._id,
    lectureId: data.lectureId || null,
    lectureTitle: data.lectureTitle || "",
    createdBy: user._id,
    title: data.title,
    content: data.content,
  });

  // Notify course instructor if a student posts a question
  if (user.role === "student" && course.instructorId.toString() !== user._id.toString()) {
    try {
      await createNotification({
        userId: course.instructorId,
        type: "discussion",
        title: `💬 New question in ${course.title}`,
        message: `${user.fullName || user.name || "A student"} asked: "${data.title}"`,
        link: `#/instructor/discussions?courseId=${course._id}`,
      });
    } catch (notifErr) {
      console.error("[DiscussionService] Notification error:", notifErr.message);
    }
  }

  return DiscussionThread.findById(thread._id)
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .lean();
};

const listThreads = async (courseId, user, options = {}) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const course = await getCourse(courseId);
  await ensureCourseAccess(course, user);

  const query = { courseId: course._id };

  if (user.role === "student") {
    query.isHidden = false;
  }

  if (options.lectureId) {
    query.lectureId = options.lectureId;
  }

  const threads = await DiscussionThread.find(query)
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .populate("moderatedBy", "fullName name email role avatarUrl")
    .sort({ createdAt: -1 })
    .lean();

  return threads.map((thread) => {
    const visiblePosts =
      user.role === "student"
        ? (thread.posts || []).filter((post) => !post.isHidden)
        : (thread.posts || []);

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

  if (thread.isHidden && user.role === "student") {
    fail(404, "Discussion thread not found");
  }
  if (thread.isLocked) {
    fail(403, "This discussion thread is locked");
  }

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

  // Notify the thread author if they are not the replier
  if (thread.createdBy.toString() !== user._id.toString()) {
    try {
      const author = await User.findById(thread.createdBy).select("role").lean();
      const targetHash = author?.role === "instructor"
        ? `#/instructor/discussions?courseId=${course._id}`
        : `#/student/discussions?courseId=${course._id}`;

      await createNotification({
        userId: thread.createdBy,
        type: "discussion",
        title: `💬 New reply in "${thread.title.slice(0, 35)}"`,
        message: `${user.fullName || user.name || "A participant"} replied: ${data.content.slice(0, 120)}`,
        link: targetHash,
      });
    } catch (notifErr) {
      console.error("[DiscussionService] Notification error:", notifErr.message);
    }
  }

  return DiscussionThread.findById(thread._id)
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .lean();
};

const moderateDiscussion = async (threadId, data, user) => {
  const thread = await getThread(threadId);
  const course = await getCourse(thread.courseId);

  // If action is "flag" (reporting inappropriate content), any user with course access can report
  if (data.action === "flag") {
    await ensureCourseAccess(course, user);
  } else {
    // Other moderation actions (hide, unhide, lock, unlock, unflag) require instructor or admin
    if (!canManageCourse(course, user)) {
      fail(403, "Only the course instructor or an admin can moderate discussions");
    }
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
      case "flag":
        thread.isFlagged = true;
        thread.flagReason = data.reason || "Reported by user";
        break;
      case "unflag":
        thread.isFlagged = false;
        thread.flagReason = "";
        break;
      default:
        fail(400, "This action is not supported for threads");
    }

    if (data.action !== "flag") {
      thread.moderatedBy = user._id;
      thread.moderatedAt = now;
    }
    await thread.save();

    return DiscussionThread.findById(thread._id)
      .populate("createdBy", "fullName name email role avatarUrl")
      .populate("posts.userId", "fullName name email role avatarUrl")
      .lean();
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
      post.flagReason = data.reason || "Reported by user";
      break;
    case "unflag":
      post.isFlagged = false;
      post.flagReason = "";
      break;
    default:
      fail(400, "This action is not supported for posts");
  }

  if (data.action !== "flag") {
    post.moderatedBy = user._id;
    post.moderatedAt = now;
  }

  await thread.save();

  return DiscussionThread.findById(thread._id)
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .lean();
};

const listModerationQueue = async (user, filter = "flagged", courseId = null) => {
  if (user.role !== "admin" && user.role !== "instructor") {
    fail(403, "Access restricted to administrators and instructors");
  }

  let allowedCourseIds = null;
  if (user.role === "instructor") {
    const courses = await Course.find({ instructorId: user._id }).select("_id").lean();
    allowedCourseIds = courses.map((c) => c._id.toString());
  }

  const query = {};

  if (courseId && courseId !== "all" && mongoose.isValidObjectId(courseId)) {
    if (user.role === "instructor" && !allowedCourseIds.includes(courseId.toString())) {
      fail(403, "You do not instruct this course");
    }
    query.courseId = new mongoose.Types.ObjectId(courseId);
  } else if (allowedCourseIds) {
    query.courseId = { $in: allowedCourseIds };
  }

  if (filter === "flagged") {
    query.$or = [{ isFlagged: true }, { "posts.isFlagged": true }];
  } else if (filter === "hidden") {
    query.$or = [{ isHidden: true }, { "posts.isHidden": true }];
  } else if (filter === "locked") {
    query.isLocked = true;
  }

  const threads = await DiscussionThread.find(query)
    .populate("courseId", "title thumbnailUrl")
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .populate("moderatedBy", "fullName name email role avatarUrl")
    .sort({ updatedAt: -1 })
    .lean();

  return threads;
};

const listUserDiscussions = async (user, options = {}) => {
  const query = {};

  if (user.role === "admin") {
    if (options.courseId && options.courseId !== "all" && mongoose.isValidObjectId(options.courseId)) {
      query.courseId = new mongoose.Types.ObjectId(options.courseId);
    }
  } else if (user.role === "instructor") {
    const courses = await Course.find({ instructorId: user._id }).select("_id").lean();
    const instructorCourseIds = courses.map((c) => c._id.toString());
    if (options.courseId && options.courseId !== "all" && mongoose.isValidObjectId(options.courseId)) {
      if (!instructorCourseIds.includes(options.courseId.toString())) {
        fail(403, "You do not instruct this course");
      }
      query.courseId = new mongoose.Types.ObjectId(options.courseId);
    } else {
      query.courseId = { $in: instructorCourseIds };
    }
  } else {
    // student
    query.isHidden = false;
    const enrollments = await Enrollment.find({ userId: user._id }).select("courseId").lean();
    const enrolledCourseIds = enrollments.map((e) => e.courseId.toString());
    if (options.courseId && options.courseId !== "all" && mongoose.isValidObjectId(options.courseId)) {
      if (!enrolledCourseIds.includes(options.courseId.toString())) {
        fail(403, "Enroll in this course first");
      }
      query.courseId = new mongoose.Types.ObjectId(options.courseId);
    } else {
      query.courseId = { $in: enrolledCourseIds };
    }
  }

  if (options.lectureId) {
    query.lectureId = options.lectureId;
  }

  const threads = await DiscussionThread.find(query)
    .populate("courseId", "title thumbnailUrl category")
    .populate("createdBy", "fullName name email role avatarUrl")
    .populate("posts.userId", "fullName name email role avatarUrl")
    .populate("moderatedBy", "fullName name email role avatarUrl")
    .sort({ updatedAt: -1 })
    .lean();

  return threads.map((thread) => {
    const visiblePosts =
      user.role === "student"
        ? (thread.posts || []).filter((post) => !post.isHidden)
        : (thread.posts || []);

    return {
      ...thread,
      posts: visiblePosts,
    };
  });
};

module.exports = {
  createThread,
  listThreads,
  listUserDiscussions,
  replyToThread,
  moderateDiscussion,
  listModerationQueue,
};
