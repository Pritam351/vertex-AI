import { api } from "./apiClient.js";

export const quizService = {
  async createQuiz(data) {
    return api("/quizzes", {
      method: "POST",
      body: data
    });
  },

  async publishQuiz(quizId) {
    return api(`/quizzes/${quizId}/publish`, {
      method: "PATCH"
    });
  },

  async listCourseQuizzes(courseId) {
    return api(`/courses/${courseId}/quizzes`);
  },

  async startAttempt(quizId) {
    return api(`/quizzes/${quizId}/attempt`, {
      method: "POST"
    });
  },

  async submitAttempt(attemptId, answers) {
    return api(`/attempts/${attemptId}/submit`, {
      method: "POST",
      body: { answers }
    });
  },

  async getMyAttempts() {
    return api("/quiz-attempts/me");
  }
};
