import { api } from "./apiClient.js";

export const adminService = {
  /** Fetch aggregated dashboard statistics. */
  async getDashboardStats() {
    return api("/admin/stats");
  },

  /** Fetch all users with optional filters. */
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

  /** Suspend or reactivate a user. */
  async updateUserStatus(userId, isActive) {
    return api(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: { isActive },
    });
  },

  /** Change a user's role (student ↔ instructor only). */
  async updateUserRole(userId, role) {
    return api(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: { role },
    });
  },

  /** Fetch all currently live (approved) courses. */
  async getPublishedCourses() {
    return api("/admin/courses/published");
  },

  /** Fetch all archived (unpublished) courses. */
  async getArchivedCourses() {
    return api("/admin/courses/archived");
  },

  /**
   * Toggle a course's publish state.
   * @param {string} courseId
   * @param {"publish"|"unpublish"} action
   */
  async toggleCoursePublish(courseId, action) {
    return api(`/admin/courses/${courseId}/publish`, {
      method: "PATCH",
      body: { action },
    });
  },
};
