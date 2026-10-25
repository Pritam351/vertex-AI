import { api, ApiError } from "../api/client.js";
import { clearSession, getSession, getWorkflow, saveSession, saveWorkflow } from "../auth/session.js";
import { errorText, initials, message, setBusy, toast } from "../components/ui.js";

const $ = (selector) => document.querySelector(selector);
const state = { session: getSession(), workflow: getWorkflow() || { course: null, modules: [], lectures: [], quizzes: [], assignments: [] } };


// function getCourseStatusLabel(course) {
//   const status = String(course?.status || "pending").toLowerCase();

//   if (status === "approved") return "APPROVED";
//   if (status === "rejected") return "REJECTED";
//   return "PENDING";
// }

// function getCourseStatusClass(course) {
//   const status = String(course?.status || "pending").toLowerCase();

//   if (status === "approved") return "published";
//   if (status === "rejected") return "rejected";
//   return "pending";
// }


function activeCourse() { return state.workflow.course; }

async function refreshInstructorCourses() {
  try {
    const payload = await api("/courses/mine");
    const courses = payload?.data?.courses || [];

    if (state.workflow.course) {
      const latest = courses.find(
        (course) => course._id === state.workflow.course._id
      );

      if (latest) {
        state.workflow.course = latest;
      }
    }

    state.instructorCourses = courses;
    saveWorkflow(state.workflow);
    render();
  } catch (error) {
    toast(`Could not refresh courses: ${errorText(error)}`, "error");
  }
}

function requireCourse(form, key) { if (activeCourse()) return true; message(form.querySelector(`[data-message="${key}"]`), "Create a course first to continue.", "error"); return false; }
function save() { saveWorkflow(state.workflow); render(); }
function showView(id) {
  document.querySelectorAll("[data-view]").forEach((view) => { const active = view.id === id; view.hidden = !active; view.classList.toggle("is-active", active); });
  document.querySelectorAll("[data-section]").forEach((link) => link.classList.toggle("is-active", link.dataset.section === id));
  $("#page-title").textContent = ({ overview: "Overview", "course-builder": "Course builder", assessments: "Assessments" })[id];
  $("#sidebar").classList.remove("is-open"); $("#menu-toggle").setAttribute("aria-expanded", "false");
}
function formatDate(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function escapeHtml(value = "") { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function render() {
  const course = activeCourse(); const hasCourse = Boolean(course);
  $("#course-count").textContent = hasCourse ? "1 active course" : "0 courses";
  $("#course-empty").hidden = hasCourse; $("#course-summary").hidden = !hasCourse;
  $("#curriculum-tools").setAttribute("aria-disabled", String(!hasCourse)); $("#assessment-tools").setAttribute("aria-disabled", String(!hasCourse));
  document.querySelectorAll(".subdued").forEach((panel) => panel.classList.toggle("is-disabled", !hasCourse));
  if (course) {
    $("#course-summary").innerHTML = `<div class="course-summary-main"><span class="course-badge">${escapeHtml(course.category || "General")}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "No description added.")}</p><code>${escapeHtml(course._id)}</code></div><div class="course-status"><span class="status pending">${escapeHtml(course.status)}</span><small>Submitted for approval</small></div>`;
    $("#active-course-placeholder").hidden = true; $("#active-course-context").hidden = false;
    $("#active-course-context").innerHTML = `<span class="status pending">${escapeHtml(course.status)}</span><h4>${escapeHtml(course.title)}</h4><p>Course ID</p><code>${escapeHtml(course._id)}</code><dl><div><dt>Modules</dt><dd>${state.workflow.modules.length}</dd></div><div><dt>Lectures</dt><dd>${state.workflow.lectures.length}</dd></div><div><dt>Assessments</dt><dd>${state.workflow.quizzes.length + state.workflow.assignments.length}</dd></div></dl>`;
  } else { $("#active-course-placeholder").hidden = false; $("#active-course-context").hidden = true; }
  const moduleSelect = $("#lecture-module"); moduleSelect.disabled = !state.workflow.modules.length;
  moduleSelect.innerHTML = state.workflow.modules.length ? `<option value="">Choose a module</option>${state.workflow.modules.map((item) => `<option value="${item._id}">${escapeHtml(item.title)}</option>`).join("")}` : '<option value="">Add a module first</option>';
  $("#module-list").innerHTML = state.workflow.modules.map((item) => `<div class="created-item"><span>Module ${item.orderIndex}</span><strong>${escapeHtml(item.title)}</strong><code>${escapeHtml(item._id)}</code></div>`).join("");
  $("#lecture-list").innerHTML = state.workflow.lectures.map((item) => `<div class="created-item"><span>Lecture</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.moduleTitle)}</small></div>`).join("");
  $("#quiz-list").innerHTML = state.workflow.quizzes.map((item) => `<div class="created-item"><span class="status ${item.isPublished ? "published" : "pending"}">${item.isPublished ? "Published" : "Draft"}</span><strong>${escapeHtml(item.title)}</strong>${item.isPublished ? "" : `<button class="mini-button" type="button" data-publish="${item._id}">Publish</button>`}</div>`).join("");
  $("#assignment-list").innerHTML = state.workflow.assignments.map((item) => `<div class="created-item"><span>Due ${formatDate(item.dueDate)}</span><strong>${escapeHtml(item.title)}</strong></div>`).join("");
}
function enterWorkspace(session) {
  state.session = session; $("#auth-screen").hidden = true; $("#workspace").hidden = false;
  $("#user-name").textContent = session.user.fullName; $("#welcome-name").textContent = session.user.fullName.split(" ")[0]; $("#user-role").textContent = "Instructor"; $("#user-initials").textContent = initials(session.user.fullName); render(); showView("overview");
  refreshInstructorCourses();
}
async function restoreSession() {
  if (!state.session?.token) return;
  try { const payload = await api("/auth/me"); const user = payload.data.user; if (user.role !== "instructor") throw new ApiError("This account does not have instructor access.", { status: 403 }); saveSession({ token: state.session.token, user }); enterWorkspace({ token: state.session.token, user }); }
  catch (error) { clearSession(); state.session = null; message($("#login-message"), error.status === 403 ? "This account is not an instructor account." : "Your saved session expired. Please sign in again.", "error"); }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); const data = Object.fromEntries(new FormData(form));
  if (!data.email || !data.password) return message($("#login-message"), "Enter your email and password.", "error");
  message($("#login-message")); setBusy(button, true);
  try { const payload = await api("/auth/login", { method: "POST", auth: false, body: data }); const { token, user } = payload.data; if (user.role !== "instructor") { clearSession(); throw new ApiError("This workspace is available to instructor accounts only.", { status: 403 }); } const session = { token, user }; saveSession(session); enterWorkspace(session); toast("Signed in successfully."); form.reset(); }
  catch (error) { message($("#login-message"), errorText(error), "error"); }
  finally { setBusy(button, false); }
});
$("#course-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); const raw = Object.fromEntries(new FormData(form)); const body = { ...raw, price: Number(raw.price || 0) }; Object.keys(body).forEach((key) => { if (body[key] === "") delete body[key]; }); message(form.querySelector('[data-message="course"]'));
  if ((body.title || "").trim().length < 3) return message(form.querySelector('[data-message="course"]'), "Course title must be at least 3 characters.", "error");
  setBusy(button, true); try { const payload = await api("/courses", { method: "POST", body }); state.workflow = { course: payload.data.course, modules: [], lectures: [], quizzes: [], assignments: [] }; save(); form.reset(); toast(payload.message || "Course created and submitted for approval."); message(form.querySelector('[data-message="course"]'), "Course created. Continue with its curriculum below.", "success"); }
  catch (error) { message(form.querySelector('[data-message="course"]'), errorText(error), "error"); } finally { setBusy(button, false); }
});
$("#module-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!requireCourse(form, "module")) return; const button = form.querySelector("button"); const raw = Object.fromEntries(new FormData(form)); const body = { title: raw.title, ...(raw.orderIndex ? { orderIndex: Number(raw.orderIndex) } : {}) }; setBusy(button, true);
  try { const payload = await api(`/courses/${activeCourse()._id}/modules`, { method: "POST", body }); state.workflow.modules.push(payload.data.module); save(); form.reset(); toast("Module added."); } catch (error) { message(form.querySelector('[data-message="module"]'), errorText(error), "error"); } finally { setBusy(button, false); }
});
$("#lecture-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!requireCourse(form, "lecture")) return; const button = form.querySelector("button"); const raw = Object.fromEntries(new FormData(form)); const resourceUrls = raw.resourceUrls.split("\n").map((url) => url.trim()).filter(Boolean); const body = { title: raw.title, ...(raw.videoUrl ? { videoUrl: raw.videoUrl } : {}), ...(raw.durationSeconds ? { durationSeconds: Number(raw.durationSeconds) } : {}), ...(raw.transcript ? { transcript: raw.transcript } : {}), ...(resourceUrls.length ? { resourceUrls } : {}) }; setBusy(button, true);
  try { const payload = await api(`/modules/${raw.moduleId}/lectures`, { method: "POST", body }); const moduleTitle = state.workflow.modules.find((item) => item._id === raw.moduleId)?.title || "Module"; state.workflow.lectures.push({ ...payload.data.lecture, moduleTitle }); save(); form.reset(); toast("Lecture added."); } catch (error) { message(form.querySelector('[data-message="lecture"]'), errorText(error), "error"); } finally { setBusy(button, false); }
});
$("#quiz-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!requireCourse(form, "quiz")) return; const button = form.querySelector("button"); const raw = Object.fromEntries(new FormData(form)); const options = [raw.optionA, raw.optionB, raw.optionC, raw.optionD].map((text, index) => ({ text, isCorrect: index === Number(raw.correctOption) })); const body = { courseId: activeCourse()._id, title: raw.title, ...(raw.instructions ? { instructions: raw.instructions } : {}), questions: [{ text: raw.questionText, type: "mcq", options, points: 1, orderIndex: 0 }], passingScore: Number(raw.passingScore), timeLimitMinutes: Number(raw.timeLimitMinutes) }; setBusy(button, true);
  try { const payload = await api("/quizzes", { method: "POST", body }); state.workflow.quizzes.push(payload.data.quiz); save(); form.reset(); toast("Quiz created as a draft."); } catch (error) { message(form.querySelector('[data-message="quiz"]'), errorText(error), "error"); } finally { setBusy(button, false); }
});
$("#assignment-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!requireCourse(form, "assignment")) return; const button = form.querySelector("button"); const raw = Object.fromEntries(new FormData(form)); let rubric; try { rubric = raw.rubric ? JSON.parse(raw.rubric) : undefined; } catch { return message(form.querySelector('[data-message="assignment"]'), "Rubric must be valid JSON, for example {\"clarity\": 40}.", "error"); } const body = { courseId: activeCourse()._id, title: raw.title, instructions: raw.instructions, dueDate: new Date(raw.dueDate).toISOString(), ...(rubric ? { rubric } : {}) }; setBusy(button, true);
  try { const payload = await api("/assignments", { method: "POST", body }); state.workflow.assignments.push(payload.data.assignment); save(); form.reset(); toast("Assignment created."); } catch (error) { message(form.querySelector('[data-message="assignment"]'), errorText(error), "error"); } finally { setBusy(button, false); }
});
$("#quiz-list").addEventListener("click", async (event) => { const button = event.target.closest("[data-publish]"); if (!button) return; setBusy(button, true); try { const payload = await api(`/quizzes/${button.dataset.publish}/publish`, { method: "PATCH" }); const quiz = state.workflow.quizzes.find((item) => item._id === button.dataset.publish); if (quiz) quiz.isPublished = payload.data.quiz.isPublished; save(); toast("Quiz published."); } catch (error) { toast(errorText(error), "error"); setBusy(button, false); } });
document.addEventListener("click", (event) => { const target = event.target.closest("[data-go], [data-section]"); if (target) { event.preventDefault(); showView(target.dataset.go || target.dataset.section); } });
$("#menu-toggle").addEventListener("click", () => { const open = $("#sidebar").classList.toggle("is-open"); $("#menu-toggle").setAttribute("aria-expanded", String(open)); });
$("#sign-out").addEventListener("click", () => { clearSession(); state.session = null; state.workflow = { course: null, modules: [], lectures: [], quizzes: [], assignments: [] }; render(); $("#workspace").hidden = true; $("#auth-screen").hidden = false; toast("Signed out."); });
window.addEventListener("vertex:session-expired", () => { state.session = null; state.workflow = { course: null, modules: [], lectures: [], quizzes: [], assignments: [] }; render(); $("#workspace").hidden = true; $("#auth-screen").hidden = false; message($("#login-message"), "Your session expired. Please sign in again.", "error"); });
render(); restoreSession();
