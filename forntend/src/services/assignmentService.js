import { api } from "./apiClient.js";

export const assignmentService = {
  async listCourseAssignments(courseId) {
    return api(`/courses/${courseId}/assignments`);
  },

  async createAssignment(data) {
    return api("/assignments", {
      method: "POST",
      body: data
    });
  },

  async submitAssignment(assignmentId, submissionData) {
    return api(`/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: submissionData
    });
  },

  async getMySubmissions() {
    return api("/submissions/me");
  },

  async gradeSubmission(submissionId, gradeData) {
    return api(`/submissions/${submissionId}/grade`, {
      method: "PUT",
      body: gradeData
    });
  }
};
