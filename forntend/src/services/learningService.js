import { api } from "./apiClient.js";

export const learningService = {
  async saveNote(lectureId, content) {
    return api(`/lectures/${lectureId}/notes`, {
      method: "PUT",
      body: { content }
    });
  },

  async getNote(lectureId) {
    return api(`/lectures/${lectureId}/notes`);
  },

  async addBookmark(lectureId) {
    return api(`/lectures/${lectureId}/bookmarks`, {
      method: "POST"
    });
  },

  async removeBookmark(lectureId) {
    return api(`/lectures/${lectureId}/bookmarks`, {
      method: "DELETE"
    });
  },

  async getMyBookmarks() {
    return api("/bookmarks/me");
  }
};
