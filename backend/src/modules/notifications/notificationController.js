
const {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("./notificationService");

const getMyNotifications = async (req, res, next) => {
  try {
    const data = await listMyNotifications(req.user._id, req.query);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await markNotificationRead(
      req.params.notificationId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const data = await markAllNotificationsRead(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
