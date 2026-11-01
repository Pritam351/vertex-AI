const gamificationService = require("./gamificationService");

const getMyStreak = async (req, res, next) => {
  try {
    const streak = await gamificationService.getMyStreak(req.user._id);
    res.status(200).json({
      success: true,
      data: streak,
    });
  } catch (error) {
    next(error);
  }
};

const getMyBadges = async (req, res, next) => {
  try {
    const data = await gamificationService.getMyBadges(req.user._id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getMyRecommendations = async (req, res, next) => {
  try {
    const data = await gamificationService.getMyRecommendations(req.user._id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyStreak,
  getMyBadges,
  getMyRecommendations,
};

