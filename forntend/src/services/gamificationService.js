import { api } from "./apiClient.js";

export const gamificationService = {
  /**
   * Fetch current and longest study streak for the current student
   */
  async getMyStreak() {
    return api("/users/me/streak");
  },

  /**
   * Fetch earned badges and milestone progress
   */
  async getMyBadges() {
    return api("/users/me/badges");
  },

  /**
   * Fetch personalized course and topic recommendations
   */
  async getMyRecommendations() {
    return api("/recommendations/me");
  },
};

