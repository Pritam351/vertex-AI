import { api } from "./apiClient.js";

export const notificationService = {
  /**
   * Fetch notifications for the current student.
   * @param {{ limit?: number, unreadOnly?: boolean }} params
   */
  async getMyNotifications(params = {}) {
    const qs = new URLSearchParams();
    if (params.limit)      qs.set("limit", String(params.limit));
    if (params.unreadOnly) qs.set("unreadOnly", "true");
    const query = qs.toString() ? `?${qs}` : "";
    return api(`/notifications/me${query}`);
  },

  /** Mark a single notification as read */
  async markAsRead(notificationId) {
    return api(`/notifications/${notificationId}/read`, { method: "PATCH" });
  },

  /** Mark ALL notifications as read */
  async markAllAsRead() {
    return api("/notifications/me/read-all", { method: "PATCH" });
  }
};

