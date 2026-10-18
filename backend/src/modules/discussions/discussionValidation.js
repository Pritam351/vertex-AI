
const mongoose = require("mongoose");

const fail = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const validObjectId = (id, label = "ID") => {
  if (!mongoose.isValidObjectId(id)) {
    fail(`Invalid ${label}`);
  }
};

const requiredText = (value, label, maxLength) => {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} is required`);
  }

  const cleaned = value.trim();

  if (cleaned.length > maxLength) {
    fail(`${label} must not exceed ${maxLength} characters`);
  }

  return cleaned;
};

const validateCreateThread = (body = {}) => ({
  courseId: (() => {
    validObjectId(body.courseId, "course ID");
    return body.courseId;
  })(),
  title: requiredText(body.title, "Title", 200),
  content: requiredText(body.content, "Content", 5000),
});

const validateReply = (body = {}) => {
  const content = requiredText(body.content, "Reply content", 5000);

  let parentPostId = null;

  if (body.parentPostId !== undefined && body.parentPostId !== null) {
    validObjectId(body.parentPostId, "parent post ID");
    parentPostId = body.parentPostId;
  }

  return { content, parentPostId };
};

const validateModeration = (body = {}) => {
  const allowedActions = ["hide", "unhide", "flag", "unflag", "lock", "unlock"];

  if (!allowedActions.includes(body.action)) {
    fail(`Action must be one of: ${allowedActions.join(", ")}`);
  }

  return {
    action: body.action,
    target: body.target || "thread",
    postId: body.postId || null,
  };
};

module.exports = {
  validObjectId,
  validateCreateThread,
  validateReply,
  validateModeration,
};
