import { api } from "./apiClient.js";

export const aiService = {
  /**
   * Send a question to the course AI tutor.
   * Sends both question & message for robust API compatibility.
   */
  async sendChatMessage(courseId, question, sessionId = null, difficulty = "beginner") {
    return api(`/ai/courses/${courseId}/chat`, {
      method: "POST",
      body: {
        question,
        message: question,
        sessionId: sessionId || undefined,
        difficulty
      }
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
  },

  async generateModuleFlashcards(moduleId, count = 10) {
    return api(`/ai/modules/${moduleId}/flashcards`, {
      method: "POST",
      body: { count }
    });
  },

  async getMyFlashcardSets() {
    return api("/ai/flashcards/me");
  },

  async getFlashcardSet(setId) {
    return api(`/ai/flashcards/${setId}`);
  }
};
