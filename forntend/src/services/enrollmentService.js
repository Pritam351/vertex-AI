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

  /**
   * Update lecture watch progress on the backend.
   * Backend validates: { watchedSeconds: number, completed?: boolean }
   */
  async updateProgress(lectureId, data = { watchedSeconds: 0, completed: false }) {
    return api(`/lectures/${lectureId}/progress`, {
      method: "POST",
      body: data
    });
  },

  /**
   * Frontend-only helper: reads per-lecture progress from localStorage.
   * Key: vertex:progress:<lectureId>
   * Returns { watchedSeconds, speed } or null.
   */
  getLectureProgress(lectureId) {
    try {
      const raw = localStorage.getItem(`vertex:progress:${lectureId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Saves per-lecture progress to localStorage (frontend only).
   */
  saveLectureProgressLocal(lectureId, data = {}) {
    try {
      localStorage.setItem(`vertex:progress:${lectureId}`, JSON.stringify(data));
    } catch {
      /* storage full – ignore */
    }
  },

  /**
   * Fetch all enrollments and return the one matching courseId (client-side filter).
   * Backend populates courseId as an object. Returns the enrollment object or null.
   */
  async getMyEnrollmentForCourse(courseId) {
    try {
      const res = await api("/enrollments/me");
      const list = res?.data?.enrollments || res?.enrollments || (Array.isArray(res?.data) ? res.data : []);
      return list.find((e) => {
        // courseId may be a populated object or a raw string/ObjectId
        const id = e.courseId?._id || e.courseId || e.course?._id || e.course;
        return String(id) === String(courseId);
      }) || null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch all LectureProgress records for the current student in a course.
   * Returns [{ lectureId, watchedSeconds, completed, lastWatchedAt }]
   * Endpoint: GET /enrollments/courses/:courseId/progress
   */
  async getCourseProgress(courseId) {
    return api(`/enrollments/courses/${courseId}/progress`);
  },

  async getCourseEnrollments(courseId) {
    return api(`/courses/${courseId}/enrollments`);
  }
};
