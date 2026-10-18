
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");

const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} = require("./notificationController");

const router = express.Router();

router.get("/notifications/me", authMiddleware, getMyNotifications);

router.patch(
  "/notifications/me/read-all",
  authMiddleware,
  markAllAsRead
);

router.patch(
  "/notifications/:notificationId/read",
  authMiddleware,
  markAsRead
);

module.exports = router;
