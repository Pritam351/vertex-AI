
const mongoose = require("mongoose");
const Notification = require("./notificationModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

// Internal helper for other backend features to create notifications.
const createNotification = async ({
  userId,
  type = "system",
  title,
  message,
  link = "",
}) => {
  if (!mongoose.isValidObjectId(userId)) {
    fail(400, "Invalid user ID");
  }

  if (!title?.trim() || !message?.trim()) {
    fail(400, "Notification title and message are required");
  }

  return Notification.create({
    userId,
    type,
    title: title.trim(),
    message: message.trim(),
    link,
  });
};

const listMyNotifications = async (userId, query = {}) => {
  const limit = Number(query.limit || 20);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    fail(400, "Limit must be between 1 and 100");
  }

  const filter = { userId };

  if (query.unreadOnly === "true") {
    filter.isRead = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return { notifications, unreadCount };
};

const markNotificationRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    fail(400, "Invalid notification ID");
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true, runValidators: true }
  );

  if (!notification) fail(404, "Notification not found");

  return notification;
};

const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return { modifiedCount: result.modifiedCount };
};

module.exports = {
  createNotification,
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
