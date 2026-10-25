import { api, ApiError } from "../api/client.js";
import { clearSession, getSession, getWorkflow, saveSession, saveWorkflow } from "../auth/session.js";
import { errorText, initials, message, setBusy, toast } from "../components/ui.js";
import { loadInstructorPages } from "../../../../src/routes/router.js";

const $ = (selector) => document.querySelector(selector);
const state = {
  session: getSession(),
  instructorCourses: [],
  workflow: getWorkflow() || { course: null, modules: [], lectures: [], quizzes: [], assignments: [] }
};

function getCourseStatusLabel(course) {
  const status = String(course?.status || "pending").toLowerCase();

  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Submitted for approval";
}

function getCourseStatusClass(course) {
  const status = String(course?.status || "pending").toLowerCase();

  if (status === "approved") return "published";
  if (status === "rejected") return "rejected";
  return "pending";
}

function activeCourse() { return state.workflow.course; }

async function loadActiveCourseDetails(courseId) {
  if (!courseId) return;

  try {
    const modRes = await api(`/courses/${courseId}/modules`);
    const modules = modRes?.data?.modules || [];

    const lectures = [];
    modules.forEach((mod) => {
      (mod.lectures || []).forEach((lec) => {
        lectures.push({
          ...lec,
          moduleId: mod._id,
          moduleTitle: mod.title
        });
      });
    });

    state.workflow.modules = modules;
    state.workflow.lectures = lectures;

    try {
      const quizRes = await api(`/courses/${courseId}/quizzes`);
      state.workflow.quizzes = quizRes?.data?.quizzes || [];
    } catch {
      state.workflow.quizzes = [];
    }

    try {
      const assignRes = await api(`/courses/${courseId}/assignments`);
      state.workflow.assignments = assignRes?.data?.assignments || [];
    } catch {
      state.workflow.assignments = [];
    }

    saveWorkflow(state.workflow);
    render();
  } catch (error) {
    console.error("Could not load course curriculum:", error);
    saveWorkflow(state.workflow);
    render();
  }
}

async function selectActiveCourse(courseId, navigateToBuilder = false) {
  const found = state.instructorCourses.find((c) => c._id === courseId);
  if (!found) return;

  state.workflow.course = found;
  saveWorkflow(state.workflow);
  render();

  await loadActiveCourseDetails(courseId);

  if (navigateToBuilder) {
    showView("course-builder");
  }
}

async function refreshInstructorCourses() {
  try {
    const payload = await api("/courses/mine");
    const courses = payload?.data?.courses || [];
    state.instructorCourses = courses;

    let targetCourse = null;
    if (state.workflow.course) {
      targetCourse = courses.find(
        (course) => course._id === state.workflow.course._id
      );
    }
    if (!targetCourse && courses.length > 0) {
      targetCourse = courses[0];
    }

    if (targetCourse) {
      state.workflow.course = targetCourse;
      await loadActiveCourseDetails(targetCourse._id);
    } else {
      state.workflow.course = null;
      state.workflow.modules = [];
      state.workflow.lectures = [];
      state.workflow.quizzes = [];
      state.workflow.assignments = [];
      saveWorkflow(state.workflow);
      render();
    }
  } catch (error) {
    toast(`Could not refresh courses: ${errorText(error)}`, "error");
  }
}

function requireCourse(form, key) { if (activeCourse()) return true; message(form.querySelector(`[data-message="${key}"]`), "Create or select a course first to continue.", "error"); return false; }
function save() { saveWorkflow(state.workflow); render(); }

function showView(id) {
  document.querySelectorAll("[data-view]").forEach((view) => { const active = view.id === id; view.hidden = !active; view.classList.toggle("is-active", active); });
  document.querySelectorAll("[data-section]").forEach((link) => link.classList.toggle("is-active", link.dataset.section === id));
  const titles = { overview: "Overview", "course-builder": "Course builder", assessments: "Assessments" };
  const pageTitle = $("#page-title");
  if (pageTitle) pageTitle.textContent = titles[id] || "Overview";
  const sidebar = $("#sidebar");
  if (sidebar) sidebar.classList.remove("is-open");
  const toggle = $("#menu-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function formatDate(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function escapeHtml(value = "") { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }

function render() {
  const course = activeCourse();
  const hasCourse = Boolean(course);
  const totalCourses = state.instructorCourses.length;

  const courseCount = $("#course-count");
  if (courseCount) {
    courseCount.textContent = totalCourses === 1 ? "1 course" : `${totalCourses} courses`;
  }

  const courseEmpty = $("#course-empty");
  if (courseEmpty) courseEmpty.hidden = totalCourses > 0;

  const listContainer = $("#courses-list-container");
  if (listContainer) {
    listContainer.innerHTML = state.instructorCourses.map((c) => {
      const isSelected = course?._id === c._id;
      const statusClass = getCourseStatusClass(c);
      const statusLabel = getCourseStatusLabel(c);
      return `
        <article class="course-card-item ${isSelected ? "is-active-card" : ""}">
          <div class="course-card-main">
            <div class="course-badges-row">
              <span class="course-badge">${escapeHtml(c.category || "General")}</span>
              <span class="status ${statusClass}">${escapeHtml(c.status || "pending")}</span>
              ${isSelected ? `<span class="active-pill">✓ Active in Studio</span>` : ""}
            </div>
            <h3>${escapeHtml(c.title)}</h3>
            <p>${escapeHtml(c.description || "No description added.")}</p>
            <code>ID: ${escapeHtml(c._id)}</code>
          </div>
          <div class="course-actions">
            <span class="course-price">${c.price > 0 ? `$${c.price}` : "Free"}</span>
            <button class="button ${isSelected ? "button-primary" : "button-secondary"} mini-button" type="button" data-switch-course="${escapeHtml(c._id)}">
              ${isSelected ? "Manage Course →" : "Select & Edit →"}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  const curriculumTools = $("#curriculum-tools");
  if (curriculumTools) curriculumTools.setAttribute("aria-disabled", String(!hasCourse));
  const assessmentTools = $("#assessment-tools");
  if (assessmentTools) assessmentTools.setAttribute("aria-disabled", String(!hasCourse));
  document.querySelectorAll(".subdued").forEach((panel) => panel.classList.toggle("is-disabled", !hasCourse));

  const placeholder = $("#active-course-placeholder");
  const activeContext = $("#active-course-context");

  if (course) {
    const statusClass = getCourseStatusClass(course);
    const statusLabel = getCourseStatusLabel(course);
    const statusText = escapeHtml(course.status || "pending");

    if (placeholder) placeholder.hidden = true;
    if (activeContext) {
      activeContext.hidden = false;

      const courseOptions = state.instructorCourses.map((c) =>
        `<option value="${escapeHtml(c._id)}" ${c._id === course._id ? "selected" : ""}>${escapeHtml(c.title)} (${getCourseStatusLabel(c)})</option>`
      ).join("");

      activeContext.innerHTML = `
        <div class="course-switcher-wrapper">
          <label for="course-switcher-select">Switch active course:</label>
          <select id="course-switcher-select" class="course-switcher-select">
            ${courseOptions}
          </select>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span class="status ${statusClass}">${statusText}</span>
          <small style="color:var(--muted);">${statusLabel}</small>
        </div>
        <h4 style="margin:0.35rem 0;">${escapeHtml(course.title)}</h4>
        <p style="margin:0 0 0.5rem; color:var(--muted); font-size:0.8rem;">ID: <code>${escapeHtml(course._id)}</code></p>
        <dl>
          <div><dt>Modules</dt><dd>${state.workflow.modules.length}</dd></div>
          <div><dt>Lectures</dt><dd>${state.workflow.lectures.length}</dd></div>
          <div><dt>Assessments</dt><dd>${state.workflow.quizzes.length + state.workflow.assignments.length}</dd></div>
        </dl>
      `;
    }
  } else {
    if (placeholder) placeholder.hidden = false;
    if (activeContext) activeContext.hidden = true;
  }

  const assessLabel = $("#assessment-course-label");
  if (assessLabel) {
    assessLabel.textContent = course ? `Active Course: ${course.title}` : "Active Course: None";
  }
  const assessDesc = $("#assessment-course-desc");
  if (assessDesc) {
    assessDesc.textContent = course 
      ? `Assessments are linked to "${course.title}". (${state.workflow.quizzes.length} quizzes, ${state.workflow.assignments.length} assignments found)`
      : "Select or create a course to unlock assessment tools.";
  }

  const moduleSelect = $("#lecture-module");
  if (moduleSelect) {
    moduleSelect.disabled = !state.workflow.modules.length;
    moduleSelect.innerHTML = state.workflow.modules.length
      ? `<option value="">Choose a module</option>${state.workflow.modules.map((item) => `<option value="${item._id}">${escapeHtml(item.title)}</option>`).join("")}`
      : '<option value="">Add a module first</option>';
  }

  const moduleList = $("#module-list");
  if (moduleList) {
    moduleList.innerHTML = state.workflow.modules.length
      ? state.workflow.modules.map((item) => `<div class="created-item"><span>Module ${item.orderIndex || 1}</span><strong>${escapeHtml(item.title)}</strong><code>${escapeHtml(item._id)}</code></div>`).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No modules added yet.</p>';
  }

  const lectureList = $("#lecture-list");
  if (lectureList) {
    lectureList.innerHTML = state.workflow.lectures.length
      ? state.workflow.lectures.map((item) => `<div class="created-item"><span>Lecture ${item.orderIndex || 1}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.moduleTitle || "Module")}${item.durationSeconds ? ` • ${Math.round(item.durationSeconds / 60)} min` : ""}</small></div>`).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No lectures added yet.</p>';
  }

  const quizList = $("#quiz-list");
  if (quizList) {
    quizList.innerHTML = state.workflow.quizzes.length
      ? state.workflow.quizzes.map((item) => `<div class="created-item"><span class="status ${item.isPublished ? "published" : "pending"}">${item.isPublished ? "Published" : "Draft"}</span><strong>${escapeHtml(item.title)}</strong>${item.isPublished ? "" : `<button class="mini-button" type="button" data-publish="${item._id}">Publish</button>`}</div>`).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No quizzes created yet.</p>';
  }

  const assignmentList = $("#assignment-list");
  if (assignmentList) {
    assignmentList.innerHTML = state.workflow.assignments.length
      ? state.workflow.assignments.map((item) => `<div class="created-item"><span>Due ${formatDate(item.dueDate)}</span><strong>${escapeHtml(item.title)}</strong></div>`).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No assignments created yet.</p>';
  }
}

function enterWorkspace(session) {
  state.session = session;
  $("#auth-screen").hidden = true;
  $("#workspace").hidden = false;
  $("#user-name").textContent = session.user.fullName;
  $("#welcome-name").textContent = session.user.fullName.split(" ")[0];
  $("#user-role").textContent = "Instructor";
  $("#user-initials").textContent = initials(session.user.fullName);
  render();
  showView("overview");
  refreshInstructorCourses();
}

async function restoreSession() {
  if (!state.session?.token) return;
  try {
    const payload = await api("/auth/me");
    const user = payload.data.user;
    if (user.role !== "instructor") throw new ApiError("This account does not have instructor access.", { status: 403 });
    saveSession({ token: state.session.token, user });
    enterWorkspace({ token: state.session.token, user });
  } catch (error) {
    clearSession();
    state.session = null;
    message($("#login-message"), error.status === 403 ? "This account is not an instructor account." : "Your saved session expired. Please sign in again.", "error");
  }
}

function bindGlobalEventListeners() {
  $("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const data = Object.fromEntries(new FormData(form));
    if (!data.email || !data.password) return message($("#login-message"), "Enter your email and password.", "error");
    message($("#login-message"));
    setBusy(button, true);
    try {
      const payload = await api("/auth/login", { method: "POST", auth: false, body: data });
      const { token, user } = payload.data;
      if (user.role !== "instructor") {
        clearSession();
        throw new ApiError("This workspace is available to instructor accounts only.", { status: 403 });
      }
      const session = { token, user };
      saveSession(session);
      enterWorkspace(session);
      toast("Signed in successfully.");
      form.reset();
    } catch (error) {
      message($("#login-message"), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  document.addEventListener("click", (event) => {
    const switchBtn = event.target.closest("[data-switch-course]");
    if (switchBtn) {
      event.preventDefault();
      selectActiveCourse(switchBtn.dataset.switchCourse, true);
      return;
    }

    const target = event.target.closest("[data-go], [data-section]");
    if (target) {
      event.preventDefault();
      showView(target.dataset.go || target.dataset.section);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "course-switcher-select") {
      selectActiveCourse(event.target.value, false);
    }
  });

  $("#menu-toggle")?.addEventListener("click", () => {
    const open = $("#sidebar")?.classList.toggle("is-open");
    $("#menu-toggle")?.setAttribute("aria-expanded", String(open));
  });

  $("#sign-out")?.addEventListener("click", () => {
    clearSession();
    state.session = null;
    state.instructorCourses = [];
    state.workflow = { course: null, modules: [], lectures: [], quizzes: [], assignments: [] };
    render();
    $("#workspace").hidden = true;
    $("#auth-screen").hidden = false;
    toast("Signed out.");
  });

  window.addEventListener("vertex:session-expired", () => {
    state.session = null;
    state.instructorCourses = [];
    state.workflow = { course: null, modules: [], lectures: [], quizzes: [], assignments: [] };
    render();
    $("#workspace").hidden = true;
    $("#auth-screen").hidden = false;
    message($("#login-message"), "Your session expired. Please sign in again.", "error");
  });
}

function bindWorkspaceEventListeners() {
  $("#course-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const body = { ...raw, price: Number(raw.price || 0) };
    Object.keys(body).forEach((key) => { if (body[key] === "") delete body[key]; });
    message(form.querySelector('[data-message="course"]'));

    if ((body.title || "").trim().length < 3) {
      return message(form.querySelector('[data-message="course"]'), "Course title must be at least 3 characters.", "error");
    }

    setBusy(button, true);
    try {
      const payload = await api("/courses", { method: "POST", body });
      const newCourse = payload.data.course;
      state.instructorCourses.unshift(newCourse);
      state.workflow = { course: newCourse, modules: [], lectures: [], quizzes: [], assignments: [] };
      save();
      form.reset();
      toast(payload.message || "Course created and submitted for approval.");
      message(form.querySelector('[data-message="course"]'), "Course created. Continue with its curriculum below.", "success");
    } catch (error) {
      message(form.querySelector('[data-message="course"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#module-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "module")) return;
    const button = form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const body = { title: raw.title, ...(raw.orderIndex ? { orderIndex: Number(raw.orderIndex) } : {}) };
    setBusy(button, true);
    try {
      const payload = await api(`/courses/${activeCourse()._id}/modules`, { method: "POST", body });
      state.workflow.modules.push(payload.data.module);
      save();
      form.reset();
      toast("Module added.");
    } catch (error) {
      message(form.querySelector('[data-message="module"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#lecture-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "lecture")) return;
    const button = form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const resourceUrls = (raw.resourceUrls || "").split("\n").map((url) => url.trim()).filter(Boolean);
    const body = {
      title: raw.title,
      ...(raw.videoUrl ? { videoUrl: raw.videoUrl } : {}),
      ...(raw.durationSeconds ? { durationSeconds: Number(raw.durationSeconds) } : {}),
      ...(raw.transcript ? { transcript: raw.transcript } : {}),
      ...(resourceUrls.length ? { resourceUrls } : {})
    };
    setBusy(button, true);
    try {
      const payload = await api(`/modules/${raw.moduleId}/lectures`, { method: "POST", body });
      const moduleTitle = state.workflow.modules.find((item) => item._id === raw.moduleId)?.title || "Module";
      state.workflow.lectures.push({ ...payload.data.lecture, moduleTitle });
      save();
      form.reset();
      toast("Lecture added.");
    } catch (error) {
      message(form.querySelector('[data-message="lecture"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#quiz-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "quiz")) return;
    const button = form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const options = [raw.optionA, raw.optionB, raw.optionC, raw.optionD].map((text, index) => ({ text, isCorrect: index === Number(raw.correctOption) }));
    const body = {
      courseId: activeCourse()._id,
      title: raw.title,
      ...(raw.instructions ? { instructions: raw.instructions } : {}),
      questions: [{ text: raw.questionText, type: "mcq", options, points: 1, orderIndex: 0 }],
      passingScore: Number(raw.passingScore),
      timeLimitMinutes: Number(raw.timeLimitMinutes)
    };
    setBusy(button, true);
    try {
      const payload = await api("/quizzes", { method: "POST", body });
      state.workflow.quizzes.push(payload.data.quiz);
      save();
      form.reset();
      toast("Quiz created as a draft.");
    } catch (error) {
      message(form.querySelector('[data-message="quiz"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#assignment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "assignment")) return;
    const button = form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    let rubric;
    try {
      rubric = raw.rubric ? JSON.parse(raw.rubric) : undefined;
    } catch {
      return message(form.querySelector('[data-message="assignment"]'), "Rubric must be valid JSON, for example {\"clarity\": 40}.", "error");
    }
    const body = {
      courseId: activeCourse()._id,
      title: raw.title,
      instructions: raw.instructions,
      dueDate: new Date(raw.dueDate).toISOString(),
      ...(rubric ? { rubric } : {})
    };
    setBusy(button, true);
    try {
      const payload = await api("/assignments", { method: "POST", body });
      state.workflow.assignments.push(payload.data.assignment);
      save();
      form.reset();
      toast("Assignment created.");
    } catch (error) {
      message(form.querySelector('[data-message="assignment"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#quiz-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-publish]");
    if (!button) return;
    setBusy(button, true);
    try {
      const payload = await api(`/quizzes/${button.dataset.publish}/publish`, { method: "PATCH" });
      const quiz = state.workflow.quizzes.find((item) => item._id === button.dataset.publish);
      if (quiz) quiz.isPublished = payload.data.quiz.isPublished;
      save();
      toast("Quiz published.");
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(button, false);
    }
  });
}

async function initializeInstructorApp() {
  const container = document.querySelector("#instructor-page-container");

  bindGlobalEventListeners();

  try {
    if (container) {
      await loadInstructorPages(container);
    }
    bindWorkspaceEventListeners();
    render();
    await restoreSession();
  } catch (error) {
    console.error("Instructor app initialization failed:", error);
    toast("Could not load the instructor pages. Check the console and try again.", "error");
    await restoreSession();
  }
}

initializeInstructorApp();
