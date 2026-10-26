import { api } from "./apiClient.js";

export const aiService = {
  async sendChatMessage(courseId, message) {
    return api(`/ai/courses/${courseId}/chat`, {
      method: "POST",
      body: { message }
    });
  },

  async getCourseChats(courseId) {
    return api(`/ai/courses/${courseId}/chats`);
  },

  async getChatSession(sessionId) {
    return api(`/ai/chats/${sessionId}`);
  },

  async summarizeLecture(lectureId) {
    return api(`/ai/lectures/${lectureId}/summarize`, {
      method: "POST"
    });
  },

  async generateLectureQuiz(lectureId) {
    return api(`/ai/lectures/${lectureId}/generate-quiz`, {
      method: "POST"
    });
  },

  async createStudyPlan(data) {
    return api("/ai/study-plan", {
      method: "POST",
      body: data
    });
  }
};
