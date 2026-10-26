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
      ? state.workflow.quizzes.map((item) => {
        const qCount = item.questions?.length || 0;
        return `<div class="created-item"><span class="status ${item.isPublished ? "published" : "pending"}">${item.isPublished ? "Published" : "Draft"}</span><strong>${escapeHtml(item.title)}</strong><small style="color:var(--muted);">${qCount} ${qCount === 1 ? "question" : "questions"} • Pass: ${item.passingScore ?? 50}%</small>${item.isPublished ? "" : `<button class="mini-button" type="button" data-publish="${item._id}">Publish</button>`}</div>`;
      }).join("")
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

  // Quiz Builder State and Helpers
  const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  let quizQuestions = [];

  function createDefaultQuestion(type = "mcq") {
    const id = "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    if (type === "short_answer") {
      return {
        id,
        type: "short_answer",
        text: "",
        points: 1,
        options: [],
        correctAnswer: ""
      };
    }
    return {
      id,
      type,
      text: "",
      points: 1,
      options: [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false }
      ],
      correctAnswer: ""
    };
  }

  function initQuizBuilder() {
    if (!quizQuestions.length) {
      quizQuestions = [createDefaultQuestion("mcq")];
    }
    renderQuizQuestions();
  }

  function renderQuizQuestions() {
    const container = $("#quiz-questions-list");
    if (!container) return;

    const countEl = $("#quiz-question-count");
    const totalPointsEl = $("#quiz-total-points");
    if (countEl) countEl.textContent = quizQuestions.length;

    const totalPoints = quizQuestions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
    if (totalPointsEl) totalPointsEl.textContent = `${totalPoints} Total ${totalPoints === 1 ? "Point" : "Points"}`;

    container.innerHTML = quizQuestions.map((q, index) => {
      const isSingle = q.type === "mcq";
      const isMulti = q.type === "multi_select";
      const isShort = q.type === "short_answer";

      let bodyHtml = "";
      if (isShort) {
        bodyHtml = `
          <div class="quiz-q-body">
            <span class="quiz-q-hint">⌨ Accepted answer (evaluation is case-insensitive):</span>
            <div class="quiz-short-answer-box">
              <input type="text" class="quiz-short-answer-input" data-action="update-short-answer" data-id="${q.id}" placeholder="e.g. HyperText Markup Language" value="${escapeHtml(q.correctAnswer || "")}" required />
            </div>
          </div>
        `;
      } else {
        const hint = isSingle
          ? "● Select the radio button of the single correct option:"
          : "☑ Check all checkboxes that are correct answers (at least 1 required):";

        const optionsHtml = q.options.map((opt, optIdx) => {
          const letter = LETTERS[optIdx] || (optIdx + 1);
          const inputType = isSingle ? "radio" : "checkbox";
          const inputName = `correct_opt_${q.id}`;
          const canDelete = q.options.length > 2;

          return `
            <div class="quiz-option-row ${opt.isCorrect ? "is-correct" : ""}" data-row-idx="${optIdx}">
              <input type="${inputType}" name="${inputName}" class="quiz-option-indicator" data-action="toggle-correct" data-id="${q.id}" data-opt-idx="${optIdx}" ${opt.isCorrect ? "checked" : ""} title="Mark as correct" />
              <span class="quiz-option-letter">${letter}.</span>
              <input type="text" class="quiz-option-input" data-action="update-option-text" data-id="${q.id}" data-opt-idx="${optIdx}" placeholder="Option ${letter}" value="${escapeHtml(opt.text || "")}" required maxlength="1000" />
              ${canDelete ? `<button type="button" class="quiz-option-delete" data-action="remove-option" data-id="${q.id}" data-opt-idx="${optIdx}" title="Remove option">✕</button>` : ""}
            </div>
          `;
        }).join("");

        const canAddOption = q.options.length < 6;

        bodyHtml = `
          <div class="quiz-q-body">
            <span class="quiz-q-hint">${hint}</span>
            <div class="quiz-options-list">
              ${optionsHtml}
            </div>
            ${canAddOption ? `<button type="button" class="quiz-add-opt-btn" data-action="add-option" data-id="${q.id}">+ Add Option</button>` : ""}
          </div>
        `;
      }

      return `
        <div class="quiz-question-card" data-card-id="${q.id}">
          <div class="quiz-q-header">
            <div class="quiz-q-header-left">
              <span class="quiz-q-pill">Q${index + 1}</span>
              <select class="quiz-q-type-select" data-action="change-type" data-id="${q.id}">
                <option value="mcq" ${isSingle ? "selected" : ""}>Single-choice MCQ</option>
                <option value="multi_select" ${isMulti ? "selected" : ""}>Multi-select MCQ</option>
                <option value="short_answer" ${isShort ? "selected" : ""}>Short answer</option>
              </select>
            </div>
            <div class="quiz-q-header-right">
              <div class="quiz-q-points-wrapper">
                <label for="pts_${q.id}">Points:</label>
                <input type="number" id="pts_${q.id}" class="quiz-q-points-input" data-action="update-points" data-id="${q.id}" min="1" max="100" value="${q.points || 1}" />
              </div>
              <button type="button" class="quiz-q-btn-remove" data-action="remove-question" data-id="${q.id}" ${quizQuestions.length <= 1 ? "disabled" : ""} title="Remove this question">
                ✕ Remove
              </button>
            </div>
          </div>
          <label class="quiz-q-prompt-label">
            Question Prompt
            <textarea class="quiz-q-prompt-input" data-action="update-text" data-id="${q.id}" placeholder="What is the question?" required maxlength="5000">${escapeHtml(q.text || "")}</textarea>
          </label>
          ${bodyHtml}
        </div>
      `;
    }).join("");
  }

  // Batch add questions (Quantity + Type)
  $("#btn-add-questions")?.addEventListener("click", () => {
    const type = $("#add-q-type")?.value || "mcq";
    const qtyInput = $("#add-q-qty");
    const qty = Math.min(20, Math.max(1, parseInt(qtyInput?.value, 10) || 1));
    for (let i = 0; i < qty; i++) {
      quizQuestions.push(createDefaultQuestion(type));
    }
    renderQuizQuestions();
    const typeLabel = type === "mcq" ? "Single-choice MCQ" : type === "multi_select" ? "Multi-select MCQ" : "Short answer";
    toast(`Added ${qty} ${typeLabel} question${qty > 1 ? "s" : ""}.`);
  });

  // Add one question button
  $("#btn-add-single-q")?.addEventListener("click", () => {
    const type = $("#add-q-type")?.value || "mcq";
    quizQuestions.push(createDefaultQuestion(type));
    renderQuizQuestions();
  });

  // Delegated events on quiz questions list
  const qListContainer = $("#quiz-questions-list");
  if (qListContainer) {
    qListContainer.addEventListener("input", (event) => {
      const target = event.target;
      const action = target.dataset.action;
      const qId = target.dataset.id;
      if (!action || !qId) return;

      const q = quizQuestions.find((item) => item.id === qId);
      if (!q) return;

      if (action === "update-text") {
        q.text = target.value;
      } else if (action === "update-short-answer") {
        q.correctAnswer = target.value;
      } else if (action === "update-option-text") {
        const optIdx = Number(target.dataset.optIdx);
        if (q.options && q.options[optIdx]) {
          q.options[optIdx].text = target.value;
        }
      } else if (action === "update-points") {
        q.points = Math.max(1, parseInt(target.value, 10) || 1);
        const totalPointsEl = $("#quiz-total-points");
        const totalPoints = quizQuestions.reduce((sum, item) => sum + (Number(item.points) || 1), 0);
        if (totalPointsEl) totalPointsEl.textContent = `${totalPoints} Total ${totalPoints === 1 ? "Point" : "Points"}`;
      }
    });

    qListContainer.addEventListener("change", (event) => {
      const target = event.target;
      const action = target.dataset.action;
      const qId = target.dataset.id;
      if (!action || !qId) return;

      const q = quizQuestions.find((item) => item.id === qId);
      if (!q) return;

      if (action === "change-type") {
        const newType = target.value;
        q.type = newType;
        if (newType === "short_answer") {
          q.options = [];
        } else {
          if (!q.options || q.options.length < 2) {
            q.options = [
              { text: "", isCorrect: true },
              { text: "", isCorrect: false },
              { text: "", isCorrect: false },
              { text: "", isCorrect: false }
            ];
          }
          if (newType === "mcq") {
            const hasCorrect = q.options.some((o) => o.isCorrect);
            if (!hasCorrect) {
              q.options[0].isCorrect = true;
            } else {
              let foundFirst = false;
              q.options.forEach((o) => {
                if (o.isCorrect && !foundFirst) {
                  foundFirst = true;
                } else if (o.isCorrect && foundFirst) {
                  o.isCorrect = false;
                }
              });
            }
          } else if (newType === "multi_select") {
            const hasCorrect = q.options.some((o) => o.isCorrect);
            if (!hasCorrect) q.options[0].isCorrect = true;
          }
        }
        renderQuizQuestions();
      } else if (action === "toggle-correct") {
        const optIdx = Number(target.dataset.optIdx);
        if (q.type === "mcq") {
          q.options.forEach((opt, idx) => {
            opt.isCorrect = idx === optIdx;
          });
          const card = target.closest(".quiz-question-card");
          if (card) {
            card.querySelectorAll(".quiz-option-row").forEach((row, idx) => {
              row.classList.toggle("is-correct", idx === optIdx);
            });
          }
        } else if (q.type === "multi_select") {
          if (q.options[optIdx]) {
            q.options[optIdx].isCorrect = target.checked;
          }
          const row = target.closest(".quiz-option-row");
          if (row) {
            row.classList.toggle("is-correct", target.checked);
          }
        }
      }
    });

    qListContainer.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      const qId = target.dataset.id;
      if (!action || !qId) return;

      const q = quizQuestions.find((item) => item.id === qId);
      if (!q) return;

      if (action === "remove-question") {
        if (quizQuestions.length > 1) {
          quizQuestions = quizQuestions.filter((item) => item.id !== qId);
          renderQuizQuestions();
        }
      } else if (action === "add-option") {
        if (q.options.length < 8) {
          q.options.push({ text: "", isCorrect: false });
          renderQuizQuestions();
        }
      } else if (action === "remove-option") {
        const optIdx = Number(target.dataset.optIdx);
        if (q.options.length > 2) {
          q.options.splice(optIdx, 1);
          if (q.type === "mcq" && !q.options.some((o) => o.isCorrect)) {
            q.options[0].isCorrect = true;
          }
          renderQuizQuestions();
        }
      }
    });
  }

  // Quiz submission
  $("#quiz-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "quiz")) return;
    const button = form.querySelector("button[type='submit']");
    const raw = Object.fromEntries(new FormData(form));
    const msgEl = form.querySelector('[data-message="quiz"]');
    message(msgEl);

    if (!raw.title || raw.title.trim().length < 3) {
      return message(msgEl, "Quiz title must be at least 3 characters long.", "error");
    }

    if (!quizQuestions.length) {
      return message(msgEl, "A quiz must contain at least one question.", "error");
    }

    // Comprehensive client-side validation
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      const qNum = i + 1;

      if (!q.text || !q.text.trim()) {
        return message(msgEl, `Question ${qNum} is missing its question prompt text.`, "error");
      }

      if (q.type === "mcq") {
        if (!q.options || q.options.length < 2) {
          return message(msgEl, `Question ${qNum} (MCQ) requires at least two options.`, "error");
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text || !q.options[j].text.trim()) {
            return message(msgEl, `Question ${qNum} Option ${LETTERS[j] || (j + 1)} cannot be blank.`, "error");
          }
        }
        const correctCount = q.options.filter((o) => o.isCorrect === true).length;
        if (correctCount !== 1) {
          return message(msgEl, `Question ${qNum} (MCQ) must have exactly one correct option selected.`, "error");
        }
      } else if (q.type === "multi_select") {
        if (!q.options || q.options.length < 2) {
          return message(msgEl, `Question ${qNum} (Multi-select) requires at least two options.`, "error");
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text || !q.options[j].text.trim()) {
            return message(msgEl, `Question ${qNum} Option ${LETTERS[j] || (j + 1)} cannot be blank.`, "error");
          }
        }
        const hasCorrect = q.options.some((o) => o.isCorrect === true);
        if (!hasCorrect) {
          return message(msgEl, `Question ${qNum} (Multi-select) requires at least one correct option checked.`, "error");
        }
      } else if (q.type === "short_answer") {
        if (!q.correctAnswer || !q.correctAnswer.trim()) {
          return message(msgEl, `Question ${qNum} (Short answer) requires an accepted correct answer.`, "error");
        }
      }
    }

    const body = {
      courseId: activeCourse()._id,
      title: raw.title.trim(),
      ...(raw.instructions?.trim() ? { instructions: raw.instructions.trim() } : {}),
      questions: quizQuestions.map((q, index) => ({
        text: q.text.trim(),
        type: q.type,
        options: q.type === "short_answer" ? [] : q.options.map((opt) => ({
          text: opt.text.trim(),
          isCorrect: Boolean(opt.isCorrect)
        })),
        ...(q.type === "short_answer" ? { correctAnswer: q.correctAnswer.trim() } : {}),
        points: Math.max(1, parseInt(q.points, 10) || 1),
        orderIndex: index
      })),
      passingScore: Math.min(100, Math.max(0, Number(raw.passingScore) || 50)),
      timeLimitMinutes: Math.min(300, Math.max(1, Number(raw.timeLimitMinutes) || 30))
    };

    setBusy(button, true);
    try {
      const payload = await api("/quizzes", { method: "POST", body });
      state.workflow.quizzes.push(payload.data.quiz);
      save();
      form.reset();
      quizQuestions = [createDefaultQuestion("mcq")];
      renderQuizQuestions();
      toast("Quiz created as a draft.");
    } catch (error) {
      message(msgEl, errorText(error), "error");
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
    initQuizBuilder();
    render();
    await restoreSession();
  } catch (error) {
    console.error("Instructor app initialization failed:", error);
    toast("Could not load the instructor pages. Check the console and try again.", "error");
    await restoreSession();
  }
}

initializeInstructorApp();
