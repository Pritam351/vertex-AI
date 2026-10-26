import { api } from "./apiClient.js";

export const enrollmentService = {
  async enroll(courseId) {
    return api(`/courses/${courseId}/enroll`, {
      method: "POST"
    });
  },

  async getMyEnrollments() {
    return api("/enrollments/me");
  },

  async updateProgress(lectureId, data = { isCompleted: true }) {
    return api(`/lectures/${lectureId}/progress`, {
      method: "POST",
      body: data
    });
  }
};
