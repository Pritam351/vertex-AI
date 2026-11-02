import { api } from "./apiClient.js";

export const announcementService = {
  // Get all announcements posted by this instructor across their courses
  async getMyAnnouncements() {
    return api("/announcements/me");
  },

  // Get announcements for a specific course
  async getCourseAnnouncements(courseId) {
    return api(`/courses/${courseId}/announcements`);
  },

  // Post announcement to a course (notifies all enrolled students)
  async createAnnouncement(courseId, data) {
    return api(`/courses/${courseId}/announcements`, {
      method: "POST",
      body: data,
    });
  },

  // Delete an announcement
  async deleteAnnouncement(announcementId) {
    return api(`/announcements/${announcementId}`, {
      method: "DELETE",
    });
  },

  // Toggle pin
  async togglePinAnnouncement(announcementId) {
    return api(`/announcements/${announcementId}/pin`, {
      method: "PATCH",
    });
  },
};

