import { api } from "./apiClient.js";

export const discussionService = {
  // Get discussions for a course (optionally filtered by lectureId)
  async getCourseDiscussions(courseId, params = {}) {
    const qs = new URLSearchParams();
    if (params.lectureId) qs.set("lectureId", params.lectureId);
    const queryString = qs.toString() ? `?${qs.toString()}` : "";
    return api(`/courses/${courseId}/discussions${queryString}`);
  },

  // Create a new discussion thread
  async createThread(data) {
    return api("/discussions", {
      method: "POST",
      body: data,
    });
  },

  // Reply to a thread
  async replyToThread(threadId, data) {
    return api(`/discussions/${threadId}/replies`, {
      method: "POST",
      body: data,
    });
  },

  // Moderate discussion (hide/unhide/lock/unlock/flag/unflag)
  async moderateDiscussion(threadId, data) {
    return api(`/discussions/${threadId}/moderation`, {
      method: "PATCH",
      body: data,
    });
  },

  // Helper: Report / flag a post or thread
  async reportThread(threadId, reason = "") {
    return this.moderateDiscussion(threadId, {
      action: "flag",
      target: "thread",
      reason,
    });
  },

  async reportPost(threadId, postId, reason = "") {
    return this.moderateDiscussion(threadId, {
      action: "flag",
      target: "post",
      postId,
      reason,
    });
  },

  // Get moderation queue (Admin & Instructor)
  async getModerationQueue(filter = "flagged") {
    return api(`/discussions/moderation?filter=${encodeURIComponent(filter)}`);
  },
};

