import { api } from "./apiClient.js";

export const courseService = {
  // Public catalog
  async listCourses(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.difficulty) query.set("difficulty", params.difficulty);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return api(`/courses${qs}`, { auth: false });
  },

  // Instructor courses
  async listMyCourses() {
    return api("/courses/mine");
  },

  // Single course details
  async getCourseById(courseId) {
    return api(`/courses/${courseId}`);
  },

  // Authoring: create course
  async createCourse(data) {
    return api("/courses", {
      method: "POST",
      body: data
    });
  },

  async updateCourse(courseId, data) {
    return api(`/courses/${courseId}`, {
      method: "PUT",
      body: data
    });
  },

  async deleteCourse(courseId) {
    return api(`/courses/${courseId}`, {
      method: "DELETE"
    });
  },

  // Curriculum: Modules
  async listModules(courseId) {
    return api(`/courses/${courseId}/modules`);
  },

  async createModule(courseId, data) {
    return api(`/courses/${courseId}/modules`, {
      method: "POST",
      body: data
    });
  },

  async updateModule(moduleId, data) {
    return api(`/modules/${moduleId}`, {
      method: "PUT",
      body: data
    });
  },

  async deleteModule(moduleId) {
    return api(`/modules/${moduleId}`, {
      method: "DELETE"
    });
  },

  // Curriculum: Lectures
  async listLectures(moduleId) {
    return api(`/modules/${moduleId}/lectures`);
  },

  async createLecture(moduleId, data) {
    return api(`/modules/${moduleId}/lectures`, {
      method: "POST",
      body: data
    });
  },

  async updateLecture(lectureId, data) {
    return api(`/lectures/${lectureId}`, {
      method: "PUT",
      body: data
    });
  },

  async deleteLecture(lectureId) {
    return api(`/lectures/${lectureId}`, {
      method: "DELETE"
    });
  },

  // Admin actions
  async getPendingCourses() {
    return api("/admin/courses/pending");
  },

  async reviewCourse(courseId, decision) {
    return api(`/admin/courses/${courseId}/approve`, {
      method: "POST",
      body: { decision }
    });
  }
};
