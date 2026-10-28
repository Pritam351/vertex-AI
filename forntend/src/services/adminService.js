import { api } from "./apiClient.js";

export const adminService = {
  /**
   * Fetch all users with optional search, role filter, and status filter.
   * @param {Object} params - { search, role, status, page, limit }
   */
  async getUsers(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.role && params.role !== "all") query.set("role", params.role);
    if (params.status && params.status !== "all") query.set("status", params.status);
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return api(`/admin/users${qs}`);
  },

  /**
   * Suspend or reactivate a user.
   * @param {string} userId
   * @param {boolean} isActive
   */
  async updateUserStatus(userId, isActive) {
    return api(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: { isActive },
    });
  },
};
