const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  getMyStreak,
  getMyBadges,
  getMyRecommendations,
} = require("./gamificationController");

const router = express.Router();

const studentOnly = [authMiddleware, requireRole("student", "admin")];

// Streak tracking
router.get("/users/me/streak", ...studentOnly, getMyStreak);

// Badges and milestones
router.get("/users/me/badges", ...studentOnly, getMyBadges);

// Personalized course recommendations
router.get("/recommendations/me", ...studentOnly, getMyRecommendations);

module.exports = router;

