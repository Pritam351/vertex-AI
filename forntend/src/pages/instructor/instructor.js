import { api, ApiError } from "../../services/apiClient.js";
import {
  clearSession,
  getSession,
  getWorkflow,
  saveWorkflow,
  getCachedInstructorCourses,
  saveCachedInstructorCourses
} from "../../store/session.js";
import { $, escapeHtml, message } from "../../utils/dom.js";
import { formatDate, initials } from "../../utils/formatters.js";
import { errorText } from "../../utils/validation.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import {
  renderInstructorCourseCard,
  getCourseStatusLabel,
  getCourseStatusClass
} from "../../components/instructor/course-card.js";
import {
  renderModuleItem,
  renderLectureItem
} from "../../components/instructor/module-list.js";
import {
  renderQuizItem,
  renderAssignmentItem
} from "../../components/instructor/assessment-list.js";
import { openModal } from "../../components/common/modal.js";
import { assignmentService } from "../../services/assignmentService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { aiService } from "../../services/aiService.js";
import { quizService } from "../../services/quizService.js";
import { courseService } from "../../services/courseService.js";
import { announcementService } from "../../services/announcementService.js";

const state = {
  session: null,
  instructorCourses: [],
  isLoadingCourses: false,
  workflow: { course: null, modules: [], lectures: [], quizzes: [], assignments: [] },
  submissions: [],
  isLoadingSubmissions: false,
  announcements: [],
  isLoadingAnnouncements: false,
  isInitialized: false
};

const instructorPages = [
  new URL("./overview.html", import.meta.url),
  new URL("./course-builder.html", import.meta.url),
  new URL("./assessments.html", import.meta.url),
  new URL("./announcements.html", import.meta.url),
  new URL("./analytics.html", import.meta.url)
];

export async function loadInstructorFragments(container) {
  if (!container) return;
  container.setAttribute("aria-busy", "true");
  try {
    const fragments = await Promise.all(
      instructorPages.map(async (pageUrl) => {
        const res = await fetch(pageUrl);
        if (!res.ok) {
          throw new Error(`Could not load ${pageUrl.pathname}: HTTP ${res.status}`);
        }
        return res.text();
      })
    );
    container.innerHTML = fragments.join("\n");
  } finally {
    container.removeAttribute("aria-busy");
  }
}

function activeCourse() {
  return state.workflow.course;
}

export function setCourseFormMode(mode, course = null) {
  const form = $("#course-form");
  if (!form) return;
  form.dataset.mode = mode;

  const heading = $("#course-form-heading");
  const subheading = $("#course-form-subheading");
  const badge = $("#course-mode-badge");
  const btnCreateSwitch = $("#btn-create-mode-switch");
  const btnCancel = $("#course-cancel-edit-btn");
  const submitLabel = $("#course-submit-label");
  const hiddenId = $("#course-form-id");

  if (mode === "edit" && course) {
    if (heading) heading.textContent = "Edit course";
    if (subheading) subheading.textContent = `Update info for "${course.title}"`;
    if (badge) {
      badge.textContent = "Editing Mode";
      badge.className = "badge active-pill";
    }
    if (btnCreateSwitch) btnCreateSwitch.style.display = "inline-flex";
    if (btnCancel) btnCancel.style.display = "inline-flex";
    if (submitLabel) submitLabel.textContent = "Save changes";
    if (hiddenId) hiddenId.value = course._id;

    const titleInput = form.querySelector('[name="title"]');
    if (titleInput) titleInput.value = course.title || "";
    const descInput = form.querySelector('[name="description"]');
    if (descInput) descInput.value = course.description || "";
    const catInput = form.querySelector('[name="category"]');
    if (catInput) catInput.value = course.category || "";
    const diffSelect = form.querySelector('[name="difficulty"]');
    if (diffSelect) diffSelect.value = course.difficulty || "beginner";
    const thumbInput = form.querySelector('[name="thumbnailUrl"]');
    if (thumbInput) thumbInput.value = course.thumbnailUrl || "";
    const priceInput = form.querySelector('[name="price"]');
    if (priceInput) priceInput.value = course.price !== undefined ? course.price : 0;
  } else {
    if (heading) heading.textContent = "Create course";
    if (subheading) subheading.textContent = "Courses are submitted as pending for approval.";
    if (badge) {
      badge.textContent = "Create Mode";
      badge.className = "badge";
    }
    if (btnCreateSwitch) btnCreateSwitch.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";
    if (submitLabel) submitLabel.textContent = "Create course";
    if (hiddenId) hiddenId.value = "";
    form.reset();
  }
}

export function setModuleFormMode(mode, module = null) {
  const form = $("#module-form");
  if (!form) return;
  form.dataset.mode = mode;

  const heading = $("#module-form-heading");
  const subheading = $("#module-form-subheading");
  const btnCancel = $("#btn-cancel-module-edit");
  const submitBtn = $("#module-submit-btn");
  const hiddenId = $("#module-form-id");

  if (mode === "edit" && module) {
    if (heading) heading.textContent = "Edit module";
    if (subheading) subheading.textContent = `Rename or reorder "${module.title}"`;
    if (btnCancel) btnCancel.style.display = "inline-flex";
    if (submitBtn) submitBtn.textContent = "Save module";
    if (hiddenId) hiddenId.value = module._id;

    const titleInput = form.querySelector('[name="title"]');
    if (titleInput) titleInput.value = module.title || "";
    const orderInput = form.querySelector('[name="orderIndex"]');
    if (orderInput) orderInput.value = module.orderIndex || 1;
  } else {
    if (heading) heading.textContent = "Add module";
    if (subheading) subheading.textContent = "Group lessons into a clear sequence.";
    if (btnCancel) btnCancel.style.display = "none";
    if (submitBtn) submitBtn.textContent = "Add module";
    if (hiddenId) hiddenId.value = "";
    form.reset();
  }
}

export function setLectureFormMode(mode, lecture = null) {
  const form = $("#lecture-form");
  if (!form) return;
  form.dataset.mode = mode;

  const heading = $("#lecture-form-heading");
  const subheading = $("#lecture-form-subheading");
  const btnCancel = $("#btn-cancel-lecture-edit");
  const submitBtn = $("#lecture-submit-btn");
  const hiddenId = $("#lecture-form-id");

  if (mode === "edit" && lecture) {
    if (heading) heading.textContent = "Edit lecture";
    if (subheading) subheading.textContent = `Update video, duration or transcript for "${lecture.title}"`;
    if (btnCancel) btnCancel.style.display = "inline-flex";
    if (submitBtn) submitBtn.textContent = "Save lecture";
    if (hiddenId) hiddenId.value = lecture._id;

    const modSelect = form.querySelector('[name="moduleId"]');
    if (modSelect) modSelect.value = lecture.moduleId || "";
    const titleInput = form.querySelector('[name="title"]');
    if (titleInput) titleInput.value = lecture.title || "";
    const vidInput = form.querySelector('[name="videoUrl"]');
    if (vidInput) vidInput.value = lecture.videoUrl || "";
    const durInput = form.querySelector('[name="durationSeconds"]');
    if (durInput) durInput.value = lecture.durationSeconds || "";
    const resInput = form.querySelector('[name="resourceUrls"]');
    if (resInput) resInput.value = Array.isArray(lecture.resourceUrls) ? lecture.resourceUrls.join("\n") : "";
    const trInput = form.querySelector('[name="transcript"]');
    if (trInput) trInput.value = lecture.transcript || "";
  } else {
    if (heading) heading.textContent = "Add lecture";
    if (subheading) subheading.textContent = "Use hosted resource links; uploads are not supported.";
    if (btnCancel) btnCancel.style.display = "none";
    if (submitBtn) submitBtn.textContent = "Add lecture";
    if (hiddenId) hiddenId.value = "";
    form.reset();
  }
}

export async function loadCourseSubmissions(courseId) {
  if (!courseId) {
    state.submissions = [];
    state.isLoadingSubmissions = false;
    renderSubmissions();
    return;
  }

  state.isLoadingSubmissions = true;
  renderSubmissions();

  try {
    const res = await assignmentService.listCourseSubmissions(courseId);
    state.submissions = res?.data?.submissions || [];
  } catch (err) {
    console.warn("Could not load submissions for course:", err);
    state.submissions = [];
  } finally {
    state.isLoadingSubmissions = false;
    renderSubmissions();
  }
}

async function loadActiveCourseDetails(courseId) {
  if (!courseId) return;

  // Trigger submission fetch for active course in parallel
  loadCourseSubmissions(courseId);

  try {
    const [modRes, quizRes, assignRes] = await Promise.all([
      api(`/courses/${courseId}/modules`).catch((err) => {
        console.warn("Could not load modules:", err);
        return null;
      }),
      api(`/courses/${courseId}/quizzes`).catch((err) => {
        console.warn("Could not load quizzes:", err);
        return null;
      }),
      api(`/courses/${courseId}/assignments`).catch((err) => {
        console.warn("Could not load assignments:", err);
        return null;
      })
    ]);

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
    state.workflow.quizzes = quizRes?.data?.quizzes || [];
    state.workflow.assignments = assignRes?.data?.assignments || [];

    saveWorkflow(state.workflow);
    render();
  } catch (error) {
    console.error("Could not load course curriculum:", error);
    saveWorkflow(state.workflow);
    render();
  }
}

export function startNewCourse() {
  state.workflow.course = null;
  state.workflow.modules = [];
  state.workflow.lectures = [];
  state.workflow.quizzes = [];
  state.workflow.assignments = [];
  state.workflow.isCreatingNew = true;
  state.submissions = [];

  // Reset course form to create mode and clear all inputs
  setCourseFormMode("create");
  const courseForm = $("#course-form");
  if (courseForm) {
    courseForm.reset();
    const idInput = $("#course-form-id");
    if (idInput) idInput.value = "";
    const msgEl = courseForm.querySelector('[data-message="course"]');
    if (msgEl) message(msgEl);
  }

  // Reset module form to create mode and clear all inputs
  setModuleFormMode("create");
  const moduleForm = $("#module-form");
  if (moduleForm) {
    moduleForm.reset();
    const modIdInput = $("#module-form-id");
    if (modIdInput) modIdInput.value = "";
    const msgEl = moduleForm.querySelector('[data-message="module"]');
    if (msgEl) message(msgEl);
  }

  // Reset lecture form to create mode and clear all inputs
  setLectureFormMode("create");
  const lectureForm = $("#lecture-form");
  if (lectureForm) {
    lectureForm.reset();
    const lecIdInput = $("#lecture-form-id");
    if (lecIdInput) lecIdInput.value = "";
    const msgEl = lectureForm.querySelector('[data-message="lecture"]');
    if (msgEl) message(msgEl);
  }

  // Reset quiz form and builder
  const quizForm = $("#quiz-form");
  if (quizForm) {
    quizForm.reset();
    const msgEl = quizForm.querySelector('[data-message="quiz"]');
    if (msgEl) message(msgEl);
  }
  quizQuestions = [createDefaultQuestion("mcq")];
  editingQuizId = null;
  renderQuizQuestions();

  // Reset assignment form
  const assignForm = $("#assignment-form");
  if (assignForm) {
    assignForm.reset();
    const msgEl = assignForm.querySelector('[data-message="assignment"]');
    if (msgEl) message(msgEl);
  }

  saveWorkflow(state.workflow);
  render();
  showView("course-builder");

  const titleInput = $("#course-form input[name='title']");
  if (titleInput) {
    $("#course-form")?.scrollIntoView({ behavior: "smooth" });
    titleInput.focus();
  }

  toast("Started fresh course outline. Enter course info to begin.");
}

export async function selectActiveCourse(courseId, navigateToBuilder = false) {
  const found = state.instructorCourses.find((c) => c._id === courseId);
  if (!found) return;

  state.workflow.isCreatingNew = false;
  state.workflow.course = found;
  saveWorkflow(state.workflow);
  render();

  setCourseFormMode("edit", found);

  await loadActiveCourseDetails(courseId);

  if (navigateToBuilder) {
    showView("course-builder");
  }
}

export async function refreshInstructorCourses() {
  try {
    if (!state.instructorCourses.length) {
      state.isLoadingCourses = true;
      render();
    }

    const payload = await api("/courses/mine");
    const courses = payload?.data?.courses || [];
    state.instructorCourses = courses;
    saveCachedInstructorCourses(courses);
    state.isLoadingCourses = false;

    let targetCourse = null;
    if (state.workflow.course) {
      targetCourse = courses.find((course) => course._id === state.workflow.course._id);
    } else if (!state.workflow.isCreatingNew && courses.length > 0) {
      targetCourse = courses[0];
    }

    if (targetCourse) {
      state.workflow.course = targetCourse;
      setCourseFormMode("edit", targetCourse);
    } else {
      state.workflow.course = null;
      state.workflow.modules = [];
      state.workflow.lectures = [];
      state.workflow.quizzes = [];
      state.workflow.assignments = [];
      setCourseFormMode("create");
    }

    // Render immediately so Overview displays all courses without waiting for curriculum sub-calls!
    saveWorkflow(state.workflow);
    render();

    // Now fetch active course curriculum details in background
    if (targetCourse) {
      await loadActiveCourseDetails(targetCourse._id);
    }
  } catch (error) {
    state.isLoadingCourses = false;
    render();
    toast(`Could not refresh courses: ${errorText(error)}`, "error");
  }
}

function requireCourse(form, key) {
  if (activeCourse()) return true;
  message(
    form.querySelector(`[data-message="${key}"]`),
    "Create or select a course first to continue.",
    "error"
  );
  return false;
}

function save() {
  saveWorkflow(state.workflow);
  render();
}

function formatAnalyticsTime(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remSec = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remSec}s`;
  }
  return `${seconds}s`;
}

function renderAnalyticsEmpty() {
  const loading = $("#analytics-loading");
  const empty = $("#analytics-empty");
  const content = $("#analytics-content");
  if (loading) loading.hidden = true;
  if (empty) empty.hidden = false;
  if (content) content.hidden = true;
}

export function renderAnalyticsData(data) {
  const empty = $("#analytics-empty");
  const content = $("#analytics-content");
  if (empty) empty.hidden = true;
  if (content) content.hidden = false;

  const { course, overview, progressDistribution, quizBreakdown, lectureBreakdown, recentEnrollments } = data;

  // 1. Banner
  const titleEl = $("#an-course-title");
  if (titleEl) titleEl.textContent = course?.title || "Course Analytics";

  const statusEl = $("#an-course-status");
  if (statusEl) {
    const s = String(course?.status || "pending").toLowerCase();
    statusEl.textContent = s.toUpperCase();
    statusEl.className = `status ${s === "approved" ? "published" : s === "rejected" ? "rejected" : "pending"}`;
  }

  const catEl = $("#an-course-category");
  if (catEl) catEl.textContent = course?.category || "General";

  const lvlEl = $("#an-course-level");
  if (lvlEl) lvlEl.textContent = course?.level || "All Levels";

  const metaEl = $("#an-course-meta");
  if (metaEl) {
    metaEl.textContent = `Modules: ${overview?.totalModules || 0} • Lectures: ${overview?.totalLectures || 0} • Quizzes: ${overview?.totalQuizzes || 0}`;
  }

  // 2. Core KPIs
  // Enrollment & Completion Rates
  const totalEnrolled = overview?.totalEnrolled || 0;
  const completedCount = overview?.completedCount || 0;
  const inProgressCount = overview?.inProgressCount || 0;
  const notStartedCount = overview?.notStartedCount || 0;
  const completionRate = overview?.completionRate || 0;

  const enrolledEl = $("#an-total-enrolled");
  if (enrolledEl) enrolledEl.textContent = totalEnrolled;

  const compBadge = $("#an-completion-rate-badge");
  if (compBadge) compBadge.textContent = `${completionRate}% Completion`;

  const compSub = $("#an-completion-sub");
  if (compSub) compSub.textContent = `${completedCount} completed • ${inProgressCount} in progress • ${notStartedCount} not started`;

  // Average Course Progress
  const avgProgress = overview?.averageProgress || 0;
  const avgProgEl = $("#an-avg-progress");
  if (avgProgEl) avgProgEl.textContent = `${avgProgress}%`;

  const progFill = $("#an-progress-meter-fill");
  if (progFill) progFill.style.width = `${Math.min(100, Math.max(0, avgProgress))}%`;

  const progSub = $("#an-progress-sub");
  if (progSub) progSub.textContent = `Mean curriculum completion across ${totalEnrolled} ${totalEnrolled === 1 ? "student" : "students"}`;

  // Average Quiz Score
  const avgQuizScore = overview?.averageQuizScore || 0;
  const quizPassRate = overview?.quizPassRate || 0;
  const totalQuizAttempts = overview?.totalQuizAttempts || 0;

  const quizScoreEl = $("#an-avg-quiz-score");
  if (quizScoreEl) quizScoreEl.textContent = `${avgQuizScore}%`;

  const quizPassBadge = $("#an-quiz-pass-badge");
  if (quizPassBadge) quizPassBadge.textContent = `${quizPassRate}% Pass Rate`;

  const quizSub = $("#an-quiz-sub");
  if (quizSub) quizSub.textContent = `From ${totalQuizAttempts} submitted ${totalQuizAttempts === 1 ? "attempt" : "attempts"}`;

  // Time-on-task
  const totalWatchedSeconds = overview?.totalWatchedSeconds || 0;
  const avgTimePerStudentSeconds = overview?.avgTimePerStudentSeconds || 0;

  const timeEl = $("#an-total-time");
  if (timeEl) timeEl.textContent = formatAnalyticsTime(totalWatchedSeconds);

  const timeBadge = $("#an-avg-time-badge");
  if (timeBadge) timeBadge.textContent = `${formatAnalyticsTime(avgTimePerStudentSeconds)} avg`;

  const timeSub = $("#an-time-sub");
  if (timeSub) timeSub.textContent = `Avg ${formatAnalyticsTime(avgTimePerStudentSeconds)} per enrolled learner`;

  // Active learners (7 days)
  const activeLearners = overview?.activeStudentsLast7Days || 0;
  const activeRate = totalEnrolled > 0 ? Math.round((activeLearners / totalEnrolled) * 100) : 0;

  const activeEl = $("#an-active-learners");
  if (activeEl) activeEl.textContent = activeLearners;

  const activeBadge = $("#an-active-rate-badge");
  if (activeBadge) activeBadge.textContent = `${activeRate}% Active`;

  // 3. Learner Progress Distribution
  const distContainer = $("#an-distribution-container");
  if (distContainer) {
    const dist = progressDistribution || { notStarted: 0, low: 0, medium: 0, high: 0, advanced: 0, completed: 0 };
    const stages = [
      { label: "Not Started (0%)", count: dist.notStarted || 0, color: "#94a3b8" },
      { label: "Early (1–25%)", count: dist.low || 0, color: "#38bdf8" },
      { label: "In-Progress (26–50%)", count: dist.medium || 0, color: "#818cf8" },
      { label: "Advanced (51–75%)", count: dist.high || 0, color: "#c084fc" },
      { label: "Near Finish (76–99%)", count: dist.advanced || 0, color: "#f472b6" },
      { label: "Completed (100%)", count: dist.completed || 0, color: "#34d399" }
    ];

    distContainer.innerHTML = stages.map((st) => {
      const pct = totalEnrolled > 0 ? Math.round((st.count / totalEnrolled) * 100) : 0;
      return `
        <div class="an-dist-card">
          <div class="an-dist-title" style="color:${st.color};">${st.label}</div>
          <div style="display:flex; align-items:baseline; margin:0.25rem 0;">
            <span class="an-dist-count">${st.count}</span>
            <span class="an-dist-pct">(${pct}%)</span>
          </div>
          <div class="an-meter-track" style="margin-top:0.4rem;">
            <div class="an-meter-fill" style="width:${pct}%; background:${st.color};"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // 4. Lecture Retention & Drop-Off
  const dropoffTbody = $("#an-lecture-dropoff-tbody");
  if (dropoffTbody) {
    const lectures = lectureBreakdown || [];
    if (!lectures.length) {
      dropoffTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.75rem; color:var(--muted);">No lectures added to this course yet.</td></tr>`;
    } else {
      dropoffTbody.innerHTML = lectures.map((lec, idx) => {
        const dropBadge = lec.dropOffRate > 25
          ? `<span class="an-badge-dropoff high">▼ ${lec.dropOffRate}%</span>`
          : lec.dropOffRate > 0
          ? `<span class="an-badge-dropoff med">▼ ${lec.dropOffRate}%</span>`
          : `<span class="an-badge-dropoff zero">0%</span>`;

        return `
          <tr>
            <td style="color:var(--muted); font-weight:600;">#${idx + 1}</td>
            <td>
              <div style="font-weight:600; color:#f8fafc;">${escapeHtml(lec.title)}</div>
              <small style="color:var(--muted); font-size:0.75rem;">📁 ${escapeHtml(lec.moduleTitle || "Module")}</small>
            </td>
            <td>${formatAnalyticsTime(lec.durationSeconds)}</td>
            <td>
              <div><strong>${lec.startedCount}</strong> <span style="font-size:0.75rem; color:var(--muted);">(${lec.startedRate}%)</span></div>
              <div class="an-meter-track" style="height:4px; margin-top:3px;"><div class="an-meter-fill" style="width:${lec.startedRate}%; background:#38bdf8;"></div></div>
            </td>
            <td>
              <div><strong>${lec.completedCount}</strong> <span style="font-size:0.75rem; color:var(--muted);">(${lec.completionRate}%)</span></div>
              <div class="an-meter-track" style="height:4px; margin-top:3px;"><div class="an-meter-fill" style="width:${lec.completionRate}%; background:#34d399;"></div></div>
            </td>
            <td>${dropBadge}</td>
            <td style="font-family:monospace; font-size:0.85rem;">${formatAnalyticsTime(lec.avgSecondsWatched)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  // 5. Quiz Performance Breakdown
  const quizzesTbody = $("#an-quizzes-tbody");
  if (quizzesTbody) {
    const quizzes = quizBreakdown || [];
    if (!quizzes.length) {
      quizzesTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.75rem; color:var(--muted);">No quizzes created for this course.</td></tr>`;
    } else {
      quizzesTbody.innerHTML = quizzes.map((q) => {
        const statusBadge = q.isPublished
          ? `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);">Published</span>`
          : `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3);">Draft</span>`;

        const scoreColor = q.averageScore >= (q.passingScore || 50) ? "#34d399" : "#fbbf24";

        return `
          <tr>
            <td>
              <div style="font-weight:600; color:#f8fafc;">${escapeHtml(q.title)}</div>
            </td>
            <td>${statusBadge}</td>
            <td>${q.questionsCount} Qs</td>
            <td><strong>${q.passingScore}%</strong></td>
            <td><strong>${q.attemptsCount}</strong></td>
            <td>
              <span style="font-weight:700; color:${scoreColor};">${q.averageScore}%</span>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-weight:600; color:#cbd5e1;">${q.passRate}%</span>
                <small style="color:var(--muted); font-size:0.75rem;">(${q.passedCount}/${q.attemptsCount})</small>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  // 6. Enrolled Students Roster
  const learnersTbody = $("#an-learners-tbody");
  if (learnersTbody) {
    const learners = recentEnrollments || [];
    if (!learners.length) {
      learnersTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.75rem; color:var(--muted);">No students have enrolled in this course yet.</td></tr>`;
    } else {
      learnersTbody.innerHTML = learners.map((stu) => {
        const prog = stu.progressPercent || 0;
        const statusLabel = prog >= 100
          ? `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399;">Completed</span>`
          : prog > 0
          ? `<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa;">In Progress</span>`
          : `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94a3b8;">Not Started</span>`;

        return `
          <tr>
            <td>
              <div class="an-user-cell">
                <div class="an-user-avatar">
                  ${stu.avatarUrl ? `<img src="${escapeHtml(stu.avatarUrl)}" alt="${escapeHtml(stu.fullName)}" />` : initials(stu.fullName)}
                </div>
                <div>
                  <div style="font-weight:600; color:#f8fafc;">${escapeHtml(stu.fullName)}</div>
                  <div style="font-size:0.75rem; color:var(--muted);">${escapeHtml(stu.email)}</div>
                </div>
              </div>
            </td>
            <td style="color:var(--muted); font-size:0.82rem;">${formatDate(stu.enrolledAt)}</td>
            <td>
              <div style="display:flex; justify-content:space-between; margin-bottom:3px; font-size:0.8rem;">
                <span style="color:#cbd5e1; font-weight:600;">${prog}%</span>
              </div>
              <div class="an-meter-track" style="height:5px;">
                <div class="an-meter-fill" style="width:${prog}%; background:${prog >= 100 ? "#10b981" : "#7c3aed"};"></div>
              </div>
            </td>
            <td style="text-align:right;">${statusLabel}</td>
          </tr>
        `;
      }).join("");
    }
  }
}

export async function loadCourseAnalytics(courseId) {
  if (!courseId) {
    renderAnalyticsEmpty();
    return;
  }

  const loading = $("#analytics-loading");
  const empty = $("#analytics-empty");
  const content = $("#analytics-content");
  const select = $("#analytics-course-select");
  if (select && select.value !== courseId) {
    select.value = courseId;
  }

  if (loading) loading.hidden = false;
  if (empty) empty.hidden = true;
  if (content) content.hidden = true;

  try {
    const res = await courseService.getCourseAnalytics(courseId);
    const data = res?.data;
    if (!data) {
      renderAnalyticsEmpty();
      return;
    }

    renderAnalyticsData(data);
  } catch (err) {
    console.error("Failed to load course analytics:", err);
    toast(`Failed to load analytics: ${errorText(err)}`, "error");
    renderAnalyticsEmpty();
  } finally {
    if (loading) loading.hidden = true;
  }
}

// ─── Course Announcements ───────────────────────────────────────────────────
function populateAnnouncementCourseSelect() {
  const select = $("#announcement-course-select");
  if (!select) return;
  const course = activeCourse();

  if (!state.instructorCourses.length) {
    select.innerHTML = '<option value="">No courses created yet</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    const currentSelected = select.value || course?._id || state.instructorCourses[0]._id;
    select.innerHTML = state.instructorCourses
      .map(
        (c) =>
          `<option value="${escapeHtml(c._id)}" ${c._id === currentSelected ? "selected" : ""}>${escapeHtml(c.title)} (${getCourseStatusLabel(c)})</option>`
      )
      .join("");
  }
}

function renderInstructorAnnouncementsEmpty() {
  const loading = $("#announcements-loading");
  const empty = $("#announcements-empty");
  const list = $("#announcements-list");
  const badge = $("#announcements-count-badge");
  if (loading) loading.hidden = true;
  if (empty) empty.hidden = false;
  if (list) list.innerHTML = "";
  if (badge) badge.textContent = "0 Total";
}

async function loadInstructorAnnouncements(courseId) {
  const loading = $("#announcements-loading");
  const empty = $("#announcements-empty");
  const list = $("#announcements-list");
  const badge = $("#announcements-count-badge");
  const select = $("#announcement-course-select");

  if (!courseId) {
    renderInstructorAnnouncementsEmpty();
    return;
  }

  if (select && select.value !== courseId) {
    select.value = courseId;
  }

  if (loading) loading.hidden = false;
  if (empty) empty.hidden = true;
  if (list) list.innerHTML = "";

  state.isLoadingAnnouncements = true;
  try {
    const res = await announcementService.getCourseAnnouncements(courseId);
    state.announcements = res?.data || res || [];
    renderInstructorAnnouncements();
  } catch (err) {
    console.error("Failed to load course announcements:", err);
    toast(`Failed to load announcements: ${errorText(err)}`, "error");
    renderInstructorAnnouncementsEmpty();
  } finally {
    state.isLoadingAnnouncements = false;
    if (loading) loading.hidden = true;
  }
}

function renderInstructorAnnouncements() {
  const loading = $("#announcements-loading");
  const empty = $("#announcements-empty");
  const list = $("#announcements-list");
  const badge = $("#announcements-count-badge");
  if (!list) return;

  if (loading) loading.hidden = true;

  const count = state.announcements.length;
  if (badge) badge.textContent = `${count} Total`;

  if (!count) {
    if (empty) empty.hidden = false;
    list.innerHTML = "";
    return;
  }

  if (empty) empty.hidden = true;
  list.innerHTML = state.announcements.map((ann) => {
    const title = escapeHtml(ann.title);
    const content = escapeHtml(ann.content).replace(/\n/g, "<br>");
    const dateStr = ann.createdAt ? new Date(ann.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "";

    const pinnedBadge = ann.isPinned
      ? `<span style="background:rgba(234,179,8,0.15);color:#fbbf24;border:1px solid rgba(234,179,8,0.3);font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:9999px;font-weight:600;">📌 Pinned</span>`
      : "";

    return `
      <div class="announcement-item" style="background:rgba(255,255,255,0.02);border:1px solid ${ann.isPinned ? "rgba(234,179,8,0.4)" : "var(--border-subtle)"};border-radius:10px;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            ${pinnedBadge}
            <h4 style="margin:0;font-size:1.05rem;font-weight:600;color:var(--text-primary);">${title}</h4>
          </div>
          <span style="font-size:0.8rem;color:var(--text-secondary);">${dateStr}</span>
        </div>
        <div style="font-size:0.9rem;line-height:1.6;color:var(--text-secondary);">
          ${content}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.25rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:0.8rem;color:var(--text-secondary);display:inline-flex;align-items:center;gap:0.35rem;">
            <span>📢</span> Broadcasted to enrolled learners
          </span>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <button 
              type="button" 
              class="button button-secondary mini-button" 
              data-action="toggle-pin-announcement" 
              data-announcement-id="${ann._id}"
              title="${ann.isPinned ? "Unpin this announcement" : "Pin this announcement"}"
              style="padding:0.3rem 0.65rem;font-size:0.75rem;"
            >
              ${ann.isPinned ? "📍 Unpin" : "📌 Pin"}
            </button>
            <button 
              type="button" 
              class="button button-danger mini-button" 
              data-action="delete-announcement" 
              data-announcement-id="${ann._id}"
              title="Delete this announcement"
              style="padding:0.3rem 0.65rem;font-size:0.75rem;"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function handlePostAnnouncement(event) {
  event.preventDefault();
  const select = $("#announcement-course-select");
  const courseId = select?.value;
  if (!courseId) {
    toast("Please select a course to post an announcement.", "error");
    return;
  }

  const titleInput = $("#announcement-title");
  const contentInput = $("#announcement-content");
  const pinnedInput = $("#announcement-pinned");
  const submitBtn = $("#btn-post-announcement");
  const feedbackEl = $("#announcement-feedback");

  const title = titleInput?.value?.trim();
  const content = contentInput?.value?.trim();
  const isPinned = Boolean(pinnedInput?.checked);

  if (!title || title.length < 3) {
    toast("Title must be at least 3 characters", "error");
    titleInput?.focus();
    return;
  }
  if (!content || content.length < 5) {
    toast("Content must be at least 5 characters", "error");
    contentInput?.focus();
    return;
  }

  setBusy(submitBtn, true);
  if (feedbackEl) feedbackEl.style.display = "none";

  try {
    const res = await announcementService.createAnnouncement(courseId, {
      title,
      content,
      isPinned
    });

    const notifiedCount = res?.data?.notifiedCount ?? 0;
    const msg = notifiedCount > 0
      ? `📢 Announcement published! ${notifiedCount} student(s) received notifications.`
      : `📢 Announcement published successfully!`;

    toast(msg, "success");

    if (feedbackEl) {
      feedbackEl.style.display = "block";
      feedbackEl.style.background = "rgba(16,185,129,0.15)";
      feedbackEl.style.color = "#34d399";
      feedbackEl.style.border = "1px solid rgba(16,185,129,0.3)";
      feedbackEl.textContent = msg;
      setTimeout(() => { if (feedbackEl) feedbackEl.style.display = "none"; }, 5000);
    }

    // Reset inputs
    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";
    if (pinnedInput) pinnedInput.checked = false;

    // Reload list
    await loadInstructorAnnouncements(courseId);
  } catch (err) {
    console.error("Failed to post announcement:", err);
    toast(`Failed to publish announcement: ${errorText(err)}`, "error");
    if (feedbackEl) {
      feedbackEl.style.display = "block";
      feedbackEl.style.background = "rgba(239,68,68,0.15)";
      feedbackEl.style.color = "#f87171";
      feedbackEl.style.border = "1px solid rgba(239,68,68,0.3)";
      feedbackEl.textContent = errorText(err);
    }
  } finally {
    setBusy(submitBtn, false);
  }
}

async function handleDeleteAnnouncement(announcementId) {
  if (!confirm("Are you sure you want to delete this announcement?")) return;
  try {
    await announcementService.deleteAnnouncement(announcementId);
    toast("Announcement deleted.", "info");
    const select = $("#announcement-course-select");
    const courseId = select?.value;
    if (courseId) {
      await loadInstructorAnnouncements(courseId);
    }
  } catch (err) {
    toast(`Failed to delete announcement: ${errorText(err)}`, "error");
  }
}

async function handleTogglePinAnnouncement(announcementId) {
  try {
    const res = await announcementService.togglePinAnnouncement(announcementId);
    const isPinned = res?.data?.isPinned;
    toast(`Announcement ${isPinned ? "pinned 📌" : "unpinned"}.`);
    const select = $("#announcement-course-select");
    const courseId = select?.value;
    if (courseId) {
      await loadInstructorAnnouncements(courseId);
    }
  } catch (err) {
    toast(`Failed to update pin status: ${errorText(err)}`, "error");
  }
}

export function showView(id) {
  document.querySelectorAll("[data-view]").forEach((view) => {
    const active = view.id === id;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });

  document.querySelectorAll("[data-section]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.section === id);
  });

  const titles = {
    overview: "Overview",
    "course-builder": "Course builder",
    assessments: "Assessments",
    announcements: "Course Announcements",
    analytics: "Detailed Analytics"
  };

  const pageTitle = $("#page-title");
  if (pageTitle) pageTitle.textContent = titles[id] || "Overview";

  const sidebar = $("#sidebar");
  if (sidebar) sidebar.classList.remove("is-open");

  const toggle = $("#menu-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", "false");

  if (window.location.hash.startsWith("#/instructor")) {
    window.location.hash = `#/instructor/${id}`;
  }

  if (id === "announcements") {
    populateAnnouncementCourseSelect();
    const select = $("#announcement-course-select");
    const selectedCourseId = select?.value || activeCourse()?._id || state.instructorCourses[0]?._id;
    if (selectedCourseId) {
      if (select && !select.value) select.value = selectedCourseId;
      loadInstructorAnnouncements(selectedCourseId);
    } else {
      renderInstructorAnnouncementsEmpty();
    }
  }

  if (id === "analytics") {
    const select = $("#analytics-course-select");
    const selectedCourseId = select?.value || activeCourse()?._id || state.instructorCourses[0]?._id;
    if (selectedCourseId) {
      loadCourseAnalytics(selectedCourseId);
    } else {
      renderAnalyticsEmpty();
    }
  }
}

export function render() {
  const course = activeCourse();
  const hasCourse = Boolean(course);
  const totalCourses = state.instructorCourses.length;

  // KPI Metrics Calculation across all instructor courses
  const approvedCourses = state.instructorCourses.filter((c) => String(c.status).toLowerCase() === "approved").length;
  const pendingCourses = state.instructorCourses.filter((c) => {
    const s = String(c.status || "pending").toLowerCase();
    return s === "pending" || (!s && s !== "approved" && s !== "rejected");
  }).length;
  const rejectedCourses = state.instructorCourses.filter((c) => String(c.status).toLowerCase() === "rejected").length;
  const totalEnrolled = state.instructorCourses.reduce((sum, c) => sum + (Number(c.enrolledStudentsCount) || 0), 0);

  const kpiTotal = $("#kpi-total-courses");
  if (kpiTotal) kpiTotal.textContent = totalCourses;
  const kpiApproved = $("#kpi-approved-courses");
  if (kpiApproved) kpiApproved.textContent = approvedCourses;
  const kpiPending = $("#kpi-pending-courses");
  if (kpiPending) kpiPending.textContent = pendingCourses;
  const kpiRejected = $("#kpi-rejected-courses");
  if (kpiRejected) kpiRejected.textContent = rejectedCourses;
  const kpiEnrolled = $("#kpi-total-enrolled");
  if (kpiEnrolled) kpiEnrolled.textContent = totalEnrolled;

  // Active Course Spotlight Banner
  const spotlight = $("#active-course-spotlight");
  if (spotlight) {
    if (course) {
      spotlight.hidden = false;
      const titleEl = $("#spotlight-course-title");
      if (titleEl) titleEl.textContent = course.title || "Untitled Course";
      const descEl = $("#spotlight-course-desc");
      if (descEl) descEl.textContent = course.description || "No description provided.";
      const statusEl = $("#spotlight-course-status");
      if (statusEl) {
        statusEl.textContent = escapeHtml(course.status || "pending");
        statusEl.className = `status ${getCourseStatusClass(course)}`;
      }
      const enrolledCount = course.enrolledStudentsCount || 0;
      const enrolledBtnCount = $("#spotlight-enrolled-count");
      if (enrolledBtnCount) enrolledBtnCount.textContent = enrolledCount;
      const enrolledNum = $("#spotlight-enrolled-num");
      if (enrolledNum) enrolledNum.textContent = enrolledCount;

      const modCount = $("#spotlight-modules-count");
      if (modCount) modCount.textContent = state.workflow.modules.length;
      const lecCount = $("#spotlight-lectures-count");
      if (lecCount) lecCount.textContent = state.workflow.lectures.length;

      const liveQuizzes = state.workflow.quizzes.filter((q) => q.isPublished).length;
      const draftQuizzes = state.workflow.quizzes.length - liveQuizzes;
      const liveEl = $("#spotlight-quizzes-live");
      if (liveEl) liveEl.textContent = liveQuizzes;
      const draftEl = $("#spotlight-quizzes-draft");
      if (draftEl) draftEl.textContent = draftQuizzes;
      const totalQuizEl = $("#spotlight-quizzes-total");
      if (totalQuizEl) totalQuizEl.textContent = state.workflow.quizzes.length;

      const assignCount = $("#spotlight-assignments-count");
      if (assignCount) assignCount.textContent = state.workflow.assignments.length;
    } else {
      spotlight.hidden = true;
    }
  }

  const courseCount = $("#course-count");
  if (courseCount) {
    if (state.isLoadingCourses && totalCourses === 0) {
      courseCount.textContent = "Loading…";
    } else {
      courseCount.textContent = totalCourses === 1 ? "1 course" : `${totalCourses} courses`;
    }
  }

  const courseEmpty = $("#course-empty");
  if (courseEmpty) {
    courseEmpty.hidden = state.isLoadingCourses || totalCourses > 0;
  }

  const listContainer = $("#courses-list-container");
  if (listContainer) {
    if (state.isLoadingCourses && totalCourses === 0) {
      listContainer.innerHTML = `
        <div class="courses-loading-state" style="padding:2.5rem; text-align:center; color:var(--muted); background:var(--surface); border:1px solid var(--line); border-radius:0.75rem;">
          <div class="spinner" style="margin:0 auto 0.75rem auto; width:28px; height:28px; border:3px solid rgba(124, 58, 237, 0.2); border-top-color:var(--violet); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
          <p style="margin:0; font-size:0.9rem; font-weight:500;">Loading your courses…</p>
        </div>
      `;
    } else {
      listContainer.innerHTML = state.instructorCourses
        .map((c) => renderInstructorCourseCard(c, course?._id === c._id))
        .join("");
    }
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

      const courseOptions = [
        ...state.instructorCourses.map(
          (c) =>
            `<option value="${escapeHtml(c._id)}" ${c._id === course._id ? "selected" : ""}>${escapeHtml(c.title)} (${getCourseStatusLabel(c)})</option>`
        ),
        `<option value="__new__">＋ Create new course...</option>`
      ].join("");

      activeContext.innerHTML = `
        <div class="course-switcher-wrapper">
          <label for="course-switcher-select">Switch active course:</label>
          <select id="course-switcher-select" class="course-switcher-select">
            ${courseOptions}
          </select>
        </div>
        ${
          course.thumbnailUrl
            ? `
          <div style="margin-bottom:0.75rem; border-radius:0.5rem; overflow:hidden; border:1px solid var(--line); aspect-ratio:16/9; max-height:130px; background:#0d1527;">
            <img src="${escapeHtml(course.thumbnailUrl)}" alt="${escapeHtml(course.title)}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.parentElement.style.display='none';" />
          </div>
        `
            : ""
        }
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
        <div class="active-course-actions" style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="mini-button button-secondary" type="button" data-action="edit-active-course" style="flex:1;">
            ✏️ Edit Info
          </button>
          <button class="mini-button button-subtle" type="button" data-action="reload-curriculum" style="flex:1;">
            ↻ Reload
          </button>
          <button class="mini-button button-primary" type="button" data-action="new-course" style="flex:1;">
            ＋ New Course
          </button>
        </div>
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
      ? state.workflow.modules.map(renderModuleItem).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No modules added yet.</p>';
  }

  const lectureList = $("#lecture-list");
  if (lectureList) {
    lectureList.innerHTML = state.workflow.lectures.length
      ? state.workflow.lectures.map(renderLectureItem).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No lectures added yet.</p>';
  }

  const aiLectureSelect = $("#ai-lecture-select");
  if (aiLectureSelect) {
    const lectures = state.workflow.lectures || [];
    if (!lectures.length) {
      aiLectureSelect.innerHTML = '<option value="">No lectures in active course</option>';
      aiLectureSelect.disabled = true;
    } else {
      aiLectureSelect.disabled = false;
      const prevVal = aiLectureSelect.value;
      aiLectureSelect.innerHTML = `
        <option value="">Choose a lecture with transcript...</option>
        ${lectures
          .map((l) => {
            const hasTranscript = Boolean(l.transcript && l.transcript.trim());
            const len = hasTranscript ? l.transcript.trim().length : 0;
            const badge = hasTranscript ? `✓ (${len.toLocaleString()} chars)` : `(No transcript)`;
            return `<option value="${l._id}" data-has-transcript="${hasTranscript}" data-len="${len}">${escapeHtml(l.title)} ${badge}</option>`;
          })
          .join("")}
      `;
      if (prevVal) aiLectureSelect.value = prevVal;
    }
  }

  const quizList = $("#quiz-list");
  if (quizList) {
    quizList.innerHTML = state.workflow.quizzes.length
      ? state.workflow.quizzes.map(renderQuizItem).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No quizzes created yet.</p>';
  }

  const assignmentList = $("#assignment-list");
  if (assignmentList) {
    assignmentList.innerHTML = state.workflow.assignments.length
      ? state.workflow.assignments.map(renderAssignmentItem).join("")
      : '<p style="color:var(--muted); font-size:0.8rem; margin-top:0.5rem;">No assignments created yet.</p>';
  }

  // Populate Analytics Course Selector
  const analyticsCourseSelect = $("#analytics-course-select");
  if (analyticsCourseSelect) {
    if (!state.instructorCourses.length) {
      analyticsCourseSelect.innerHTML = '<option value="">No courses created yet</option>';
      analyticsCourseSelect.disabled = true;
    } else {
      analyticsCourseSelect.disabled = false;
      const currentSelected = analyticsCourseSelect.value || course?._id || state.instructorCourses[0]._id;
      analyticsCourseSelect.innerHTML = state.instructorCourses
        .map(
          (c) =>
            `<option value="${escapeHtml(c._id)}" ${c._id === currentSelected ? "selected" : ""}>${escapeHtml(c.title)} (${getCourseStatusLabel(c)})</option>`
        )
        .join("");
    }
  }

  // Populate Announcements Course Selector
  populateAnnouncementCourseSelect();

  // Render Student Submissions & Grading table
  renderSubmissions();
}

export function renderSubmissions() {
  const course = activeCourse();
  const activeCourseName = $("#submissions-active-course-name");
  if (activeCourseName) {
    activeCourseName.textContent = course ? `"${course.title}"` : "the selected course";
  }

  const countPill = $("#submissions-count-pill");
  const loading = $("#submissions-loading");
  const empty = $("#submissions-empty");
  const emptyText = $("#submissions-empty-text");
  const wrapper = $("#submissions-table-wrapper");
  const tbody = $("#submissions-table-body");

  if (!course) {
    if (loading) loading.hidden = true;
    if (wrapper) wrapper.hidden = true;
    if (empty) empty.hidden = false;
    if (emptyText) emptyText.textContent = "Select an active course above to view and grade student submissions.";
    if (countPill) countPill.textContent = "No course selected";
    return;
  }

  if (state.isLoadingSubmissions) {
    if (loading) loading.hidden = false;
    if (empty) empty.hidden = true;
    if (wrapper) wrapper.hidden = true;
    if (countPill) countPill.textContent = "Loading…";
    return;
  }

  if (loading) loading.hidden = true;

  const submissions = state.submissions || [];
  const pendingCount = submissions.filter((s) => s.grade === null || s.grade === undefined).length;

  if (countPill) {
    countPill.textContent = submissions.length === 0
      ? "0 submissions"
      : `${submissions.length} submission${submissions.length === 1 ? "" : "s"} (${pendingCount} pending)`;
  }

  if (submissions.length === 0) {
    if (empty) empty.hidden = false;
    if (emptyText) emptyText.textContent = `No student submissions found for "${course.title}".`;
    if (wrapper) wrapper.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  if (wrapper) wrapper.hidden = false;

  if (tbody) {
    tbody.innerHTML = submissions
      .map((sub) => {
        const student = sub.userId || {};
        const studentName = student.fullName || student.name || "Anonymous Student";
        const studentEmail = student.email || "No email";
        const studentAvatar = student.avatarUrl
          ? `<img src="${escapeHtml(student.avatarUrl)}" alt="${escapeHtml(studentName)}" />`
          : initials(studentName);

        const assignment = sub.assignmentId || {};
        const assignmentTitle = assignment.title || "Assignment";
        const dueDateDisplay = assignment.dueDate ? formatDate(assignment.dueDate) : "No deadline";

        const submittedDate = sub.submittedAt
          ? formatDate(sub.submittedAt)
          : sub.createdAt
          ? formatDate(sub.createdAt)
          : "Recently";

        const isGraded = sub.grade !== null && sub.grade !== undefined;
        const statusBadge = isGraded
          ? `<span class="status-badge-graded">✓ Graded: ${sub.grade}/100</span>`
          : `<span class="status-badge-pending">⏳ Pending Review</span>`;

        const workLink = sub.fileUrl
          ? `<a href="${escapeHtml(sub.fileUrl)}" target="_blank" rel="noopener noreferrer" class="work-link">📎 View Work ↗</a>`
          : `<span style="color:var(--muted); font-size:0.8rem;">No link provided</span>`;

        return `
          <tr data-submission-id="${escapeHtml(sub._id)}">
            <td>
              <div class="student-cell">
                <div class="student-avatar">${studentAvatar}</div>
                <div class="student-info">
                  <span class="student-name">${escapeHtml(studentName)}</span>
                  <span class="student-email">${escapeHtml(studentEmail)}</span>
                </div>
              </div>
            </td>
            <td>
              <strong style="color:#f1f5f9;">${escapeHtml(assignmentTitle)}</strong>
            </td>
            <td>
              <span style="font-family:'DM Mono',monospace; font-size:0.8rem; color:#fca5a5;">📅 ${dueDateDisplay}</span>
            </td>
            <td>
              <span style="font-family:'DM Mono',monospace; font-size:0.8rem; color:var(--muted);">🕒 ${submittedDate}</span>
            </td>
            <td>${statusBadge}</td>
            <td>${workLink}</td>
            <td style="text-align:right;">
              <button class="button ${isGraded ? "button-secondary" : "button-primary"} mini-button" type="button" data-grade-submission="${escapeHtml(sub._id)}">
                ${isGraded ? "Update Grade" : "Grade Submission"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }
}

export async function handleOpenGradeModal(submissionId) {
  const sub = state.submissions.find((s) => s._id === submissionId);
  if (!sub) return;

  const student = sub.userId || {};
  const studentName = student.fullName || student.name || "Student";
  const assignment = sub.assignmentId || {};
  const assignmentTitle = assignment.title || "Assignment";
  const currentGrade = sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
  const currentFeedback = sub.feedback || "";

  const contentHtml = `
    <div style="margin-bottom:1.25rem; padding:0.9rem; background:rgba(255,255,255,0.03); border:1px solid var(--line); border-radius:0.6rem;">
      <p style="margin:0 0 0.35rem; font-size:0.85rem;"><strong style="color:var(--muted);">Student:</strong> <span style="color:#fff;">${escapeHtml(studentName)}</span> (${escapeHtml(student.email || "")})</p>
      <p style="margin:0 0 0.35rem; font-size:0.85rem;"><strong style="color:var(--muted);">Assignment:</strong> <span style="color:#fff;">${escapeHtml(assignmentTitle)}</span></p>
      ${sub.fileUrl ? `<p style="margin:0; font-size:0.85rem;"><strong style="color:var(--muted);">Submitted Work:</strong> <a href="${escapeHtml(sub.fileUrl)}" target="_blank" rel="noopener noreferrer" class="work-link" style="display:inline-flex; margin-left:0.35rem;">📎 Open link ↗</a></p>` : ""}
    </div>
    <form id="submission-grade-form" onsubmit="return false;">
      <div class="grade-form-group">
        <label for="grade-input">Grade (0 - 100) *</label>
        <input type="number" id="grade-input" name="grade" min="0" max="100" value="${escapeHtml(String(currentGrade))}" placeholder="e.g. 95" required />
      </div>
      <div class="grade-form-group">
        <label for="feedback-input">Feedback / Instructor Notes (optional)</label>
        <textarea id="feedback-input" name="feedback" rows="4" placeholder="Great submission! Highlight key observations or areas for improvement...">${escapeHtml(currentFeedback)}</textarea>
      </div>
    </form>
  `;

  openModal({
    title: `Grade Submission: ${assignmentTitle}`,
    contentHtml,
    confirmText: "Submit Grade",
    onConfirm: async (backdrop, close) => {
      const gradeInput = backdrop.querySelector("#grade-input");
      const feedbackInput = backdrop.querySelector("#feedback-input");
      const gradeVal = Number(gradeInput?.value);

      if (isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100) {
        toast("Please enter a valid grade between 0 and 100.", "error");
        gradeInput?.focus();
        return;
      }

      const feedbackVal = feedbackInput?.value?.trim() || "";

      const confirmBtn = backdrop.querySelector(".modal-confirm");
      if (confirmBtn) setBusy(confirmBtn, true, "Saving…");

      try {
        const res = await assignmentService.gradeSubmission(sub._id, {
          grade: gradeVal,
          feedback: feedbackVal
        });

        // Update local state
        const updatedSub = res?.data?.submission;
        if (updatedSub) {
          const idx = state.submissions.findIndex((s) => s._id === sub._id);
          if (idx !== -1) {
            state.submissions[idx] = {
              ...state.submissions[idx],
              ...updatedSub,
              userId: updatedSub.userId || state.submissions[idx].userId,
              assignmentId: updatedSub.assignmentId || state.submissions[idx].assignmentId
            };
          }
        } else {
          sub.grade = gradeVal;
          sub.feedback = feedbackVal;
        }

        renderSubmissions();
        toast("Grade submitted successfully! ✓");
        close();
      } catch (err) {
        toast(`Grading failed: ${errorText(err)}`, "error");
        if (confirmBtn) setBusy(confirmBtn, false);
      }
    }
  });
}

export async function handleViewCourseEnrollments() {
  const course = activeCourse();
  if (!course) {
    toast("No active course selected.", "error");
    return;
  }

  const btn = $("#btn-view-course-enrollments");
  if (btn) setBusy(btn, true, "Loading…");

  try {
    const res = await enrollmentService.getCourseEnrollments(course._id);
    const enrollments = res?.data?.enrollments || [];

    const enrolledListHtml = enrollments.length === 0
      ? `<div style="text-align:center; padding:2rem 1rem; color:var(--muted);">
           <p style="font-size:1.5rem; margin-bottom:0.5rem;">👥</p>
           <p style="margin:0;">No students have enrolled in "${escapeHtml(course.title)}" yet.</p>
         </div>`
      : `<div style="max-height:400px; overflow-y:auto;">
           ${enrollments.map((enr) => {
             const student = enr.userId || {};
             const studentName = student.fullName || student.name || "Student";
             const studentEmail = student.email || "No email";
             const studentAvatar = student.avatarUrl
               ? `<img src="${escapeHtml(student.avatarUrl)}" alt="${escapeHtml(studentName)}" />`
               : initials(studentName);
             const enrolledDate = enr.enrolledAt ? formatDate(enr.enrolledAt) : (enr.createdAt ? formatDate(enr.createdAt) : "Unknown date");
             const completedLectures = Array.isArray(enr.completedLectures) ? enr.completedLectures.length : 0;
             const progressPct = enr.progress !== undefined ? enr.progress : 0;

             return `
               <div class="enrolled-student-row">
                 <div class="student-cell">
                   <div class="student-avatar">${studentAvatar}</div>
                   <div class="student-info">
                     <span class="student-name">${escapeHtml(studentName)}</span>
                     <span class="student-email">${escapeHtml(studentEmail)}</span>
                   </div>
                 </div>
                 <div class="enrolled-student-progress">
                   <span class="progress-pill">${progressPct}% progress</span>
                   <span style="color:var(--muted); font-size:0.7rem;">${completedLectures} lectures • Joined ${enrolledDate}</span>
                 </div>
               </div>
             `;
           }).join("")}
         </div>`;

    openModal({
      title: `Enrolled Students (${enrollments.length}) - ${course.title}`,
      contentHtml: enrolledListHtml,
      confirmText: "Done",
      onConfirm: (backdrop, close) => close()
    });
  } catch (err) {
    toast(`Could not load enrollments: ${errorText(err)}`, "error");
  } finally {
    if (btn) setBusy(btn, false);
  }
}

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

let editingQuizId = null;

function loadQuizForEditing(quiz) {
  if (!quiz) return;
  editingQuizId = quiz._id;
  const form = $("#quiz-form");
  if (!form) return;

  const titleInput = form.querySelector('input[name="title"]');
  const instructionsInput = form.querySelector('textarea[name="instructions"]');
  const passingScoreInput = form.querySelector('input[name="passingScore"]');
  const timeLimitInput = form.querySelector('input[name="timeLimitMinutes"]');

  if (titleInput) titleInput.value = quiz.title || "";
  if (instructionsInput) instructionsInput.value = quiz.instructions || "";
  if (passingScoreInput) passingScoreInput.value = quiz.passingScore ?? 50;
  if (timeLimitInput) timeLimitInput.value = quiz.timeLimitMinutes ?? 30;

  if (quiz.questions && quiz.questions.length > 0) {
    quizQuestions = quiz.questions.map((q, idx) => ({
      id: q._id || "q_" + Date.now() + "_" + idx,
      type: q.type || "mcq",
      text: q.text || "",
      points: q.points || 1,
      options: (q.options || []).map((opt) => ({
        text: opt.text || "",
        isCorrect: Boolean(opt.isCorrect)
      })),
      correctAnswer: q.correctAnswer || ""
    }));
  } else {
    quizQuestions = [createDefaultQuestion("mcq")];
  }

  renderQuizQuestions();
  form.scrollIntoView({ behavior: "smooth" });
  toast(`Loaded "${quiz.title}" for editing.`);
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
  if (totalPointsEl) {
    totalPointsEl.textContent = `${totalPoints} Total ${totalPoints === 1 ? "Point" : "Points"}`;
  }

  container.innerHTML = quizQuestions
    .map((q, index) => {
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

        const optionsHtml = q.options
          .map((opt, optIdx) => {
            const letter = LETTERS[optIdx] || optIdx + 1;
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
          })
          .join("");

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
    })
    .join("");
}

function bindQuizBuilderEvents() {
  $("#btn-add-questions")?.addEventListener("click", () => {
    const type = $("#add-q-type")?.value || "mcq";
    const qtyInput = $("#add-q-qty");
    const qty = Math.min(20, Math.max(1, parseInt(qtyInput?.value, 10) || 1));
    for (let i = 0; i < qty; i++) {
      quizQuestions.push(createDefaultQuestion(type));
    }
    renderQuizQuestions();
    const typeLabel =
      type === "mcq"
        ? "Single-choice MCQ"
        : type === "multi_select"
        ? "Multi-select MCQ"
        : "Short answer";
    toast(`Added ${qty} ${typeLabel} question${qty > 1 ? "s" : ""}.`);
  });

  $("#btn-add-single-q")?.addEventListener("click", () => {
    const type = $("#add-q-type")?.value || "mcq";
    quizQuestions.push(createDefaultQuestion(type));
    renderQuizQuestions();
  });

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
        if (totalPointsEl) {
          totalPointsEl.textContent = `${totalPoints} Total ${totalPoints === 1 ? "Point" : "Points"}`;
        }
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
}

function bindWorkspaceEventListeners() {
  $("#course-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("#course-submit-btn") || form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const mode = form.dataset.mode || "create";
    const courseId = raw.courseId || $("#course-form-id")?.value;

    const body = {
      title: (raw.title || "").trim(),
      description: (raw.description || "").trim(),
      category: (raw.category || "").trim(),
      difficulty: raw.difficulty,
      price: Number(raw.price || 0)
    };
    if (typeof raw.thumbnailUrl === "string" && raw.thumbnailUrl.trim()) {
      body.thumbnailUrl = raw.thumbnailUrl.trim();
    }
    Object.keys(body).forEach((key) => {
      if (body[key] === "" || body[key] === undefined) delete body[key];
    });
    message(form.querySelector('[data-message="course"]'));

    if (!body.title || body.title.length < 3) {
      return message(
        form.querySelector('[data-message="course"]'),
        "Course title must be at least 3 characters.",
        "error"
      );
    }

    setBusy(button, true);
    try {
      if (mode === "edit" && courseId) {
        const payload = await api(`/courses/${courseId}`, {
          method: "PUT",
          body
        });
        const updatedCourse = payload.data.course;
        const idx = state.instructorCourses.findIndex((c) => c._id === updatedCourse._id);
        if (idx !== -1) {
          state.instructorCourses[idx] = updatedCourse;
        }
        if (state.workflow.course?._id === updatedCourse._id) {
          state.workflow.course = updatedCourse;
        }
        save();
        toast("Course updated successfully.");
        message(
          form.querySelector('[data-message="course"]'),
          "Course updated successfully.",
          "success"
        );
      } else {
        const payload = await api("/courses", { method: "POST", body });
        const newCourse = payload.data.course;
        state.instructorCourses.unshift(newCourse);
        state.workflow = {
          course: newCourse,
          modules: [],
          lectures: [],
          quizzes: [],
          assignments: [],
          isCreatingNew: false
        };
        save();
        setCourseFormMode("edit", newCourse);
        toast(payload.message || "Course created and submitted for approval.");
        message(
          form.querySelector('[data-message="course"]'),
          "Course created! You can continue editing it or build its curriculum below.",
          "success"
        );
      }
    } catch (error) {
      message(form.querySelector('[data-message="course"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#btn-create-mode-switch")?.addEventListener("click", () => startNewCourse());
  $("#course-cancel-edit-btn")?.addEventListener("click", () => {
    if (activeCourse()) {
      setCourseFormMode("edit", activeCourse());
    } else {
      startNewCourse();
    }
  });

  $("#module-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "module")) return;
    const button = form.querySelector("#module-submit-btn") || form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const mode = form.dataset.mode || "create";
    const moduleId = raw.moduleId || $("#module-form-id")?.value;

    const body = {
      title: raw.title,
      ...(raw.orderIndex ? { orderIndex: Number(raw.orderIndex) } : {})
    };
    setBusy(button, true);
    try {
      if (mode === "edit" && moduleId) {
        const payload = await api(`/modules/${moduleId}`, {
          method: "PUT",
          body
        });
        const updatedModule = payload.data.module;
        const modIdx = state.workflow.modules.findIndex((m) => m._id === moduleId);
        if (modIdx !== -1) {
          state.workflow.modules[modIdx] = {
            ...state.workflow.modules[modIdx],
            ...updatedModule
          };
        }
        state.workflow.lectures.forEach((lec) => {
          if (lec.moduleId === moduleId) {
            lec.moduleTitle = updatedModule.title;
          }
        });
        save();
        setModuleFormMode("create");
        toast("Module updated successfully.");
      } else {
        const payload = await api(`/courses/${activeCourse()._id}/modules`, {
          method: "POST",
          body
        });
        state.workflow.modules.push(payload.data.module);
        save();
        form.reset();
        toast("Module added.");
      }
    } catch (error) {
      message(form.querySelector('[data-message="module"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#btn-cancel-module-edit")?.addEventListener("click", () => setModuleFormMode("create"));

  $("#lecture-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!requireCourse(form, "lecture")) return;
    const button = form.querySelector("#lecture-submit-btn") || form.querySelector("button");
    const raw = Object.fromEntries(new FormData(form));
    const mode = form.dataset.mode || "create";
    const lectureId = raw.lectureId || $("#lecture-form-id")?.value;

    const resourceUrls = (raw.resourceUrls || "")
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);
    const body = {
      title: raw.title,
      ...(raw.videoUrl !== undefined ? { videoUrl: raw.videoUrl } : {}),
      ...(raw.durationSeconds !== undefined ? { durationSeconds: Number(raw.durationSeconds || 0) } : {}),
      ...(raw.transcript !== undefined ? { transcript: raw.transcript } : {}),
      ...(resourceUrls.length ? { resourceUrls } : {})
    };
    setBusy(button, true);
    try {
      if (mode === "edit" && lectureId) {
        const payload = await api(`/lectures/${lectureId}`, {
          method: "PUT",
          body
        });
        const updatedLecture = payload.data.lecture;
        const moduleTitle =
          state.workflow.modules.find((item) => item._id === (raw.moduleId || updatedLecture.moduleId))?.title || "Module";
        const lecIdx = state.workflow.lectures.findIndex((l) => l._id === lectureId);
        if (lecIdx !== -1) {
          state.workflow.lectures[lecIdx] = { ...updatedLecture, moduleTitle };
        }
        state.workflow.modules.forEach((mod) => {
          if (Array.isArray(mod.lectures)) {
            const mIdx = mod.lectures.findIndex((l) => l._id === lectureId);
            if (mIdx !== -1) {
              mod.lectures[mIdx] = { ...updatedLecture, moduleTitle };
            }
          }
        });
        save();
        setLectureFormMode("create");
        toast("Lecture updated successfully.");
      } else {
        const payload = await api(`/modules/${raw.moduleId}/lectures`, {
          method: "POST",
          body
        });
        const moduleTitle =
          state.workflow.modules.find((item) => item._id === raw.moduleId)?.title || "Module";
        state.workflow.lectures.push({ ...payload.data.lecture, moduleTitle });
        const targetMod = state.workflow.modules.find((m) => m._id === raw.moduleId);
        if (targetMod) {
          if (!Array.isArray(targetMod.lectures)) targetMod.lectures = [];
          targetMod.lectures.push({ ...payload.data.lecture, moduleTitle });
        }
        save();
        form.reset();
        toast("Lecture added.");
      }
    } catch (error) {
      message(form.querySelector('[data-message="lecture"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#btn-cancel-lecture-edit")?.addEventListener("click", () => setLectureFormMode("create"));

  // Helper for saving or saving & publishing quiz
  async function handleQuizSave({ publish = false, button }) {
    const form = $("#quiz-form");
    if (!form) return;
    if (!requireCourse(form, "quiz")) return;
    const raw = Object.fromEntries(new FormData(form));
    const msgEl = form.querySelector('[data-message="quiz"]');
    message(msgEl);

    if (!raw.title || raw.title.trim().length < 3) {
      return message(msgEl, "Quiz title must be at least 3 characters long.", "error");
    }

    if (!quizQuestions.length) {
      return message(msgEl, "A quiz must contain at least one question.", "error");
    }

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
            return message(
              msgEl,
              `Question ${qNum} Option ${LETTERS[j] || j + 1} cannot be blank.`,
              "error"
            );
          }
        }
        const correctCount = q.options.filter((o) => o.isCorrect === true).length;
        if (correctCount !== 1) {
          return message(
            msgEl,
            `Question ${qNum} (MCQ) must have exactly one correct option selected.`,
            "error"
          );
        }
      } else if (q.type === "multi_select") {
        if (!q.options || q.options.length < 2) {
          return message(
            msgEl,
            `Question ${qNum} (Multi-select) requires at least two options.`,
            "error"
          );
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text || !q.options[j].text.trim()) {
            return message(
              msgEl,
              `Question ${qNum} Option ${LETTERS[j] || j + 1} cannot be blank.`,
              "error"
            );
          }
        }
        const hasCorrect = q.options.some((o) => o.isCorrect === true);
        if (!hasCorrect) {
          return message(
            msgEl,
            `Question ${qNum} (Multi-select) requires at least one correct option checked.`,
            "error"
          );
        }
      } else if (q.type === "short_answer") {
        if (!q.correctAnswer || !q.correctAnswer.trim()) {
          return message(
            msgEl,
            `Question ${qNum} (Short answer) requires an accepted correct answer.`,
            "error"
          );
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
        options:
          q.type === "short_answer"
            ? []
            : q.options.map((opt) => ({
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
      let savedQuiz;
      if (editingQuizId) {
        const payload = await quizService.updateQuiz(editingQuizId, body);
        savedQuiz = payload.data.quiz;
        const idx = state.workflow.quizzes.findIndex((q) => q._id === editingQuizId);
        if (idx !== -1) {
          state.workflow.quizzes[idx] = savedQuiz;
        } else {
          state.workflow.quizzes.push(savedQuiz);
        }
      } else {
        const payload = await quizService.createQuiz(body);
        savedQuiz = payload.data.quiz;
        state.workflow.quizzes.push(savedQuiz);
      }

      if (publish && savedQuiz?._id) {
        const pubPayload = await quizService.publishQuiz(savedQuiz._id);
        savedQuiz.isPublished = pubPayload?.data?.quiz?.isPublished ?? true;
        const idx = state.workflow.quizzes.findIndex((q) => q._id === savedQuiz._id);
        if (idx !== -1) state.workflow.quizzes[idx] = savedQuiz;
        toast("Quiz saved and published successfully! 🚀 Available for enrolled students.");
      } else {
        toast(editingQuizId ? "Quiz updated successfully." : "Quiz saved as a draft.");
      }

      editingQuizId = null;
      save();
      form.reset();
      quizQuestions = [createDefaultQuestion("mcq")];
      renderQuizQuestions();
      render();
    } catch (error) {
      message(msgEl, errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  }

  // AI Lecture select preview update
  $("#ai-lecture-select")?.addEventListener("change", (e) => {
    const selectedOpt = e.target.selectedOptions[0];
    const preview = $("#ai-transcript-preview");
    const statusText = $("#ai-transcript-status-text");
    if (!preview || !statusText) return;
    if (!e.target.value) {
      preview.style.display = "none";
      return;
    }
    const hasTranscript = selectedOpt?.dataset.hasTranscript === "true";
    const charLen = Number(selectedOpt?.dataset.len || 0);
    preview.style.display = "flex";
    if (hasTranscript) {
      statusText.innerHTML = `<strong>Transcript ready:</strong> ${charLen.toLocaleString()} characters available for Gemini AI generation`;
      statusText.style.color = "#86efac";
    } else {
      statusText.innerHTML = `<strong>No transcript:</strong> Add transcript text to this lecture in the Course Builder first.`;
      statusText.style.color = "#fca5a5";
    }
  });

  // AI Ingest & Embed button
  $("#btn-ingest-transcript")?.addEventListener("click", async (e) => {
    const course = activeCourse();
    if (!course) {
      toast("Please select an active course first.", "error");
      return;
    }
    const lectureId = $("#ai-lecture-select")?.value;
    if (!lectureId) {
      toast("Please select a lecture from the dropdown first.", "error");
      return;
    }
    const lecture = state.workflow.lectures.find((l) => l._id === lectureId);
    if (!lecture || !lecture.transcript || !lecture.transcript.trim()) {
      toast("The selected lecture has no transcript text to ingest.", "error");
      return;
    }

    const btn = e.currentTarget;
    setBusy(btn, true, "Ingesting...");
    try {
      await aiService.ingestLecture(lectureId);
      try {
        await aiService.embedLecture(lectureId, course._id);
      } catch (embErr) {
        console.warn("Embedding notice:", embErr);
      }
      toast("⚡ Transcript ingested and chunked for AI processing!");
    } catch (err) {
      toast(`Ingestion failed: ${errorText(err)}`, "error");
    } finally {
      setBusy(btn, false);
    }
  });

  // AI Generate Quiz button
  $("#btn-generate-ai-quiz")?.addEventListener("click", async (e) => {
    const course = activeCourse();
    if (!course) {
      toast("Please select an active course first.", "error");
      return;
    }
    const lectureId = $("#ai-lecture-select")?.value;
    if (!lectureId) {
      toast("Please select a lecture with transcript content.", "error");
      return;
    }
    const lecture = state.workflow.lectures.find((l) => l._id === lectureId);
    if (!lecture || !lecture.transcript || !lecture.transcript.trim()) {
      toast("The selected lecture has no transcript text. Add transcript content in Course Builder first.", "error");
      return;
    }

    const count = Math.min(10, Math.max(5, Number($("#ai-question-count")?.value) || 5));
    const btn = e.currentTarget;
    setBusy(btn, true, `Generating ${count} questions with Gemini AI...`);

    try {
      const res = await aiService.generateLectureQuiz(lectureId, { questionCount: count });
      const data = res.data;
      const questions = (data?.quiz?.questions || data?.questions || []);

      if (!questions.length) {
        throw new Error("No questions were generated by the AI model. Please try again.");
      }

      // Pre-fill quiz title and instructions in form
      const form = $("#quiz-form");
      if (form) {
        const titleInput = form.querySelector('input[name="title"]');
        const instructionsInput = form.querySelector('textarea[name="instructions"]');
        if (titleInput) {
          titleInput.value = data.title || data?.quiz?.title || `AI Quiz: ${lecture.title}`;
        }
        if (instructionsInput && !instructionsInput.value) {
          instructionsInput.value = `Knowledge check generated from lecture "${lecture.title}". Review each question carefully.`;
        }
      }

      // Load questions into quizQuestions for interactive review and editing
      quizQuestions = questions.map((q, idx) => ({
        id: q._id || "q_" + Date.now() + "_" + idx,
        type: q.type || "mcq",
        text: q.text || "",
        points: q.points || 1,
        options: (q.options || []).map((opt) => ({
          text: opt.text || "",
          isCorrect: Boolean(opt.isCorrect)
        })),
        correctAnswer: q.correctAnswer || ""
      }));

      editingQuizId = data.quizId || data.quiz?._id || null;

      // If backend created a draft quiz, add/update in state workflow
      if (data.quiz) {
        const existingIdx = state.workflow.quizzes.findIndex((q) => q._id === data.quiz._id);
        if (existingIdx !== -1) {
          state.workflow.quizzes[existingIdx] = data.quiz;
        } else {
          state.workflow.quizzes.push(data.quiz);
        }
        save();
        render();
      }

      renderQuizQuestions();
      $("#quiz-questions-list")?.scrollIntoView({ behavior: "smooth" });
      toast(`✨ ${quizQuestions.length} questions generated by Gemini AI! Review and edit them below before saving or publishing.`);
    } catch (err) {
      toast(`AI Quiz Generation failed: ${errorText(err)}`, "error");
    } finally {
      setBusy(btn, false);
    }
  });

  // Save Quiz Draft submit
  $("#quiz-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = $("#btn-save-quiz-draft") || e.currentTarget.querySelector("button[type='submit']");
    handleQuizSave({ publish: false, button: btn });
  });

  // Save & Publish button click
  $("#btn-save-and-publish-quiz")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleQuizSave({ publish: true, button: e.currentTarget });
  });

  // Quiz publish and edit click delegation
  $("#quiz-list")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-quiz]");
    if (editBtn) {
      const quizId = editBtn.dataset.editQuiz;
      const quiz = state.workflow.quizzes.find((item) => item._id === quizId);
      if (quiz) loadQuizForEditing(quiz);
      return;
    }

    const pubBtn = event.target.closest("[data-publish]");
    if (pubBtn) {
      const quizId = pubBtn.dataset.publish;
      setBusy(pubBtn, true);
      try {
        const payload = await quizService.publishQuiz(quizId);
        const quiz = state.workflow.quizzes.find((item) => item._id === quizId);
        if (quiz) quiz.isPublished = payload.data.quiz.isPublished;
        save();
        render();
        toast("Quiz published! Available for enrolled students.");
      } catch (error) {
        toast(errorText(error), "error");
        setBusy(pubBtn, false);
      }
    }
  });

  // Assignment submission
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
      return message(
        form.querySelector('[data-message="assignment"]'),
        'Rubric must be valid JSON, for example {"clarity": 40}.',
        "error"
      );
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
      render();
      toast("Assignment created.");
    } catch (error) {
      message(form.querySelector('[data-message="assignment"]'), errorText(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  // Post Announcement submit
  $("#announcement-form")?.addEventListener("submit", handlePostAnnouncement);
}

function bindGlobalClickHandlers() {
  document.addEventListener("click", async (event) => {
    const switchBtn = event.target.closest("[data-switch-course]");
    if (switchBtn) {
      event.preventDefault();
      selectActiveCourse(switchBtn.dataset.switchCourse, true);
      return;
    }

    const editCourseBtn = event.target.closest('[data-action="edit-active-course"]');
    if (editCourseBtn) {
      event.preventDefault();
      if (activeCourse()) {
        setCourseFormMode("edit", activeCourse());
        $("#course-form")?.scrollIntoView({ behavior: "smooth" });
        $("#course-form input[name='title']")?.focus();
      }
      return;
    }

    const reloadBtn = event.target.closest('[data-action="reload-curriculum"]');
    if (reloadBtn) {
      event.preventDefault();
      if (activeCourse()) {
        setBusy(reloadBtn, true, "Reloading…");
        try {
          await loadActiveCourseDetails(activeCourse()._id);
          toast("Curriculum reloaded and verified from database! ✓");
        } catch (err) {
          toast(`Failed to reload curriculum: ${errorText(err)}`, "error");
        } finally {
          setBusy(reloadBtn, false);
        }
      }
      return;
    }

    const renameModBtn = event.target.closest("[data-rename-module]");
    if (renameModBtn) {
      event.preventDefault();
      const modId = renameModBtn.dataset.renameModule;
      const found = state.workflow.modules.find((m) => m._id === modId);
      if (found) {
        setModuleFormMode("edit", found);
        $("#module-form")?.scrollIntoView({ behavior: "smooth" });
        $("#module-form input[name='title']")?.focus();
      }
      return;
    }

    const delModBtn = event.target.closest("[data-delete-module]");
    if (delModBtn) {
      event.preventDefault();
      const modId = delModBtn.dataset.deleteModule;
      const mod = state.workflow.modules.find((m) => m._id === modId);
      if (!mod) return;
      if (!confirm(`Are you sure you want to delete module "${mod.title}" and its lectures?`)) return;
      setBusy(delModBtn, true);
      try {
        await api(`/modules/${modId}`, { method: "DELETE" });
        state.workflow.modules = state.workflow.modules.filter((m) => m._id !== modId);
        state.workflow.lectures = state.workflow.lectures.filter((l) => l.moduleId !== modId);
        setModuleFormMode("create");
        save();
        toast("Module deleted successfully.");
      } catch (err) {
        toast(`Failed to delete module: ${errorText(err)}`, "error");
      } finally {
        setBusy(delModBtn, false);
      }
      return;
    }

    const editLecBtn = event.target.closest("[data-edit-lecture]");
    if (editLecBtn) {
      event.preventDefault();
      const lecId = editLecBtn.dataset.editLecture;
      const found = state.workflow.lectures.find((l) => l._id === lecId);
      if (found) {
        setLectureFormMode("edit", found);
        $("#lecture-form")?.scrollIntoView({ behavior: "smooth" });
        $("#lecture-form input[name='title']")?.focus();
      }
      return;
    }

    const delLecBtn = event.target.closest("[data-delete-lecture]");
    if (delLecBtn) {
      event.preventDefault();
      const lecId = delLecBtn.dataset.deleteLecture;
      const lec = state.workflow.lectures.find((l) => l._id === lecId);
      if (!lec) return;
      if (!confirm(`Are you sure you want to delete lecture "${lec.title}"?`)) return;
      setBusy(delLecBtn, true);
      try {
        await api(`/lectures/${lecId}`, { method: "DELETE" });
        state.workflow.lectures = state.workflow.lectures.filter((l) => l._id !== lecId);
        state.workflow.modules.forEach((mod) => {
          if (Array.isArray(mod.lectures)) {
            mod.lectures = mod.lectures.filter((l) => l._id !== lecId);
          }
        });
        setLectureFormMode("create");
        save();
        toast("Lecture deleted successfully.");
      } catch (err) {
        toast(`Failed to delete lecture: ${errorText(err)}`, "error");
      } finally {
        setBusy(delLecBtn, false);
      }
      return;
    }

    const toggleTrBtn = event.target.closest("[data-toggle-transcript]");
    if (toggleTrBtn) {
      event.preventDefault();
      const lecId = toggleTrBtn.dataset.toggleTranscript;
      const panel = $(`#transcript-preview-${lecId}`);
      if (panel) {
        panel.hidden = !panel.hidden;
      }
      return;
    }

    const refreshCoursesBtn = event.target.closest('[data-action="refresh-courses-btn"]');
    if (refreshCoursesBtn) {
      event.preventDefault();
      setBusy(refreshCoursesBtn, true, "Refreshing…");
      try {
        await refreshInstructorCourses();
        toast("Courses and metrics refreshed! ✓");
      } catch (err) {
        toast(`Failed to refresh courses: ${errorText(err)}`, "error");
      } finally {
        setBusy(refreshCoursesBtn, false);
      }
      return;
    }

    const refreshSubsBtn = event.target.closest("#btn-refresh-submissions");
    if (refreshSubsBtn) {
      event.preventDefault();
      if (activeCourse()) {
        setBusy(refreshSubsBtn, true);
        try {
          await loadCourseSubmissions(activeCourse()._id);
          toast("Submissions refreshed! ✓");
        } catch (err) {
          toast(`Failed to refresh submissions: ${errorText(err)}`, "error");
        } finally {
          setBusy(refreshSubsBtn, false);
        }
      }
      return;
    }

    const viewEnrollmentsBtn = event.target.closest("#btn-view-course-enrollments");
    if (viewEnrollmentsBtn) {
      event.preventDefault();
      await handleViewCourseEnrollments();
      return;
    }

    const gradeBtn = event.target.closest("[data-grade-submission]");
    if (gradeBtn) {
      event.preventDefault();
      const submissionId = gradeBtn.dataset.gradeSubmission;
      await handleOpenGradeModal(submissionId);
      return;
    }

    const newCourseBtn = event.target.closest('[data-action="new-course"]');
    if (newCourseBtn) {
      event.preventDefault();
      startNewCourse();
      return;
    }

    const refreshAnalyticsBtn = event.target.closest("#btn-refresh-analytics");
    if (refreshAnalyticsBtn) {
      event.preventDefault();
      const select = $("#analytics-course-select");
      const courseId = select?.value || activeCourse()?._id || state.instructorCourses[0]?._id;
      if (courseId) {
        setBusy(refreshAnalyticsBtn, true);
        try {
          await loadCourseAnalytics(courseId);
          toast("Analytics refreshed! ✓");
        } catch (err) {
          toast(`Failed to refresh analytics: ${errorText(err)}`, "error");
        } finally {
          setBusy(refreshAnalyticsBtn, false);
        }
      }
      return;
    }

    const viewAnalyticsBtn = event.target.closest('[data-action="view-course-analytics"], [data-view-analytics]');
    if (viewAnalyticsBtn) {
      event.preventDefault();
      const courseId = viewAnalyticsBtn.dataset.viewAnalytics || viewAnalyticsBtn.dataset.courseId || activeCourse()?._id;
      showView("analytics");
      if (courseId) {
        const select = $("#analytics-course-select");
        if (select) select.value = courseId;
        await loadCourseAnalytics(courseId);
      }
      return;
    }

    const refreshAnnounceBtn = event.target.closest("#btn-refresh-announcements");
    if (refreshAnnounceBtn) {
      event.preventDefault();
      const select = $("#announcement-course-select");
      const courseId = select?.value || activeCourse()?._id || state.instructorCourses[0]?._id;
      if (courseId) {
        setBusy(refreshAnnounceBtn, true);
        try {
          await loadInstructorAnnouncements(courseId);
          toast("Announcements refreshed! ✓");
        } catch (err) {
          toast(`Failed to refresh announcements: ${errorText(err)}`, "error");
        } finally {
          setBusy(refreshAnnounceBtn, false);
        }
      }
      return;
    }

    const delAnnounceBtn = event.target.closest('[data-action="delete-announcement"]');
    if (delAnnounceBtn) {
      event.preventDefault();
      const annId = delAnnounceBtn.dataset.announcementId;
      if (annId) await handleDeleteAnnouncement(annId);
      return;
    }

    const pinAnnounceBtn = event.target.closest('[data-action="toggle-pin-announcement"]');
    if (pinAnnounceBtn) {
      event.preventDefault();
      const annId = pinAnnounceBtn.dataset.announcementId;
      if (annId) await handleTogglePinAnnouncement(annId);
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
      if (event.target.value === "__new__") {
        startNewCourse();
      } else {
        selectActiveCourse(event.target.value, false);
      }
    } else if (event.target.id === "analytics-course-select") {
      const selectedId = event.target.value;
      if (selectedId) {
        loadCourseAnalytics(selectedId);
      }
    } else if (event.target.id === "announcement-course-select") {
      const selectedId = event.target.value;
      if (selectedId) {
        loadInstructorAnnouncements(selectedId);
      }
    }
  });
}

export async function mountInstructorWorkspace(container, initialSection = "overview") {
  state.session = getSession();
  state.workflow = getWorkflow() || {
    course: null,
    modules: [],
    lectures: [],
    quizzes: [],
    assignments: []
  };

  const cachedCourses = getCachedInstructorCourses();
  if (Array.isArray(cachedCourses) && cachedCourses.length > 0) {
    state.instructorCourses = cachedCourses;
    state.isLoadingCourses = false;
    if (!state.workflow.course && !state.workflow.isCreatingNew) {
      state.workflow.course = cachedCourses[0];
    }
  } else {
    state.isLoadingCourses = true;
  }

  await loadInstructorFragments(container);

  if (!state.isInitialized) {
    bindGlobalClickHandlers();
    state.isInitialized = true;
  }

  bindWorkspaceEventListeners();
  initQuizBuilder();
  bindQuizBuilderEvents();

  render();
  showView(initialSection);
  await refreshInstructorCourses();
}
