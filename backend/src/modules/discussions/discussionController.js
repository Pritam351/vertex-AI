const {
  createThread,
  listThreads,
  replyToThread,
  moderateDiscussion,
  listModerationQueue,
} = require("./discussionService");

const {
  validateCreateThread,
  validateReply,
  validateModeration,
} = require("./discussionValidation");

const createDiscussionThread = async (req, res, next) => {
  try {
    const data = validateCreateThread(req.body);
    const thread = await createThread(data, req.user);

    return res.status(201).json({
      success: true,
      message: "Discussion thread created",
      data: thread,
    });
  } catch (error) {
    next(error);
  }
};

const getCourseThreads = async (req, res, next) => {
  try {
    const options = {
      lectureId: req.query.lectureId || null,
    };
    const threads = await listThreads(req.params.courseId, req.user, options);

    return res.status(200).json({
      success: true,
      count: threads.length,
      data: threads,
    });
  } catch (error) {
    next(error);
  }
};

const createReply = async (req, res, next) => {
  try {
    const data = validateReply(req.body);
    const thread = await replyToThread(
      req.params.threadId,
      data,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Reply added",
      data: thread,
    });
  } catch (error) {
    next(error);
  }
};

const moderateThread = async (req, res, next) => {
  try {
    const data = validateModeration(req.body);
    const thread = await moderateDiscussion(
      req.params.threadId,
      data,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Discussion moderation updated",
      data: thread,
    });
  } catch (error) {
    next(error);
  }
};

const getModerationQueue = async (req, res, next) => {
  try {
    const filter = req.query.filter || "flagged";
    const queue = await listModerationQueue(req.user, filter);

    return res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDiscussionThread,
  getCourseThreads,
  createReply,
  moderateThread,
  getModerationQueue,
};
