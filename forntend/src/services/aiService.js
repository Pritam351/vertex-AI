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

  async generateLectureQuiz(lectureId, data = {}) {
    return api(`/ai/lectures/${lectureId}/generate-quiz`, {
      method: "POST",
      body: data
    });
  },

  async ingestLecture(lectureId) {
    return api(`/ai/lectures/${lectureId}/ingest`, {
      method: "POST"
    });
  },

  async embedLecture(lectureId, courseId) {
    return api(`/ai/lectures/${lectureId}/embed`, {
      method: "POST",
      body: { courseId }
    });
  },

  async retrieveCourseContext(courseId, question) {
    return api(`/ai/courses/${courseId}/retrieve`, {
      method: "POST",
      body: { question }
    });
  },

  async createStudyPlan(data) {
    return api("/ai/study-plan", {
      method: "POST",
      body: data
    });
  }
};
