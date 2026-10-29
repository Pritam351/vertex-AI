import { quizService }      from "../../services/quizService.js";
import { assignmentService } from "../../services/assignmentService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { $, escapeHtml }     from "../../utils/dom.js";
import { formatDate }        from "../../utils/formatters.js";
import { toast }             from "../../components/common/toast.js";
import { setBusy }           from "../../components/common/loading.js";
import { openModal }         from "../../components/common/modal.js";
import { errorText }         from "../../utils/validation.js";

// ─── Score circle SVG helper ───────────────────────────────────────────────────
function scoreRing(pct, passed) {
  const r   = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = passed ? "#52d8c2" : "#ff6b6b";
  return `
    <svg width="72" height="72" viewBox="0 0 72 72" style="flex-shrink:0;">
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="#1e2a44" stroke-width="6"/>
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
        stroke-dashoffset="${(circ / 4).toFixed(1)}"
        stroke-linecap="round"/>
      <text x="36" y="40" text-anchor="middle" font-size="13" font-weight="700"
        font-family="DM Mono,monospace" fill="${color}">${pct}%</text>
    </svg>`;
}

// ─── Quiz modal HTML ───────────────────────────────────────────────────────────
function buildQuizHtml(quiz) {
  const questions = quiz.questions || [];
  const questionsHtml = questions.map((q, idx) => {
    const num       = idx + 1;
    const isSingle  = q.type === "mcq";
    const isMulti   = q.type === "multi_select";
    const isShort   = q.type === "short_answer";
    const typeLabel = isSingle ? "Single Choice" : isMulti ? "Multi-Select" : "Short Answer";
    const inputType = isSingle ? "radio" : "checkbox";

    let inputHtml;
    if (isShort) {
      inputHtml = `
        <div class="quiz-short-answer-wrap">
          <input type="text" name="q_${q._id}"
            class="quiz-short-input"
            placeholder="Type your answer here…"
            autocomplete="off" />
        </div>`;
    } else {
      const options = q.options || [];
      inputHtml = `
        <div class="quiz-options-list">
          ${options.map(opt => `
            <label class="quiz-option-label">
              <input type="${inputType}" name="q_${q._id}" value="${escapeHtml(opt._id)}" class="quiz-option-input" />
              <span class="quiz-option-text">${escapeHtml(opt.text)}</span>
            </label>
          `).join("")}
        </div>`;
    }

    return `
      <div class="quiz-question-card" data-qid="${q._id}">
        <div class="quiz-question-meta">
          <span class="quiz-question-num">Q${num} &nbsp;·&nbsp; ${q.points || 1} pt</span>
          <span class="quiz-type-badge">${typeLabel}</span>
        </div>
        <p class="quiz-question-text">${escapeHtml(q.text)}</p>
        ${inputHtml}
      </div>`;
  }).join("");

  return `
    <div class="quiz-modal-instructions">
      <span class="quiz-instr-icon" aria-hidden="true">ℹ️</span>
      <div>
        <p style="margin:0 0 0.25rem 0;">${escapeHtml(quiz.instructions || "Answer all questions to the best of your ability, then click Submit Quiz.")}</p>
        <div style="font-size:0.75rem; color:var(--muted); font-family:'DM Mono',monospace;" id="quiz-answered-tracker">
          Progress: 0 / ${questions.length} questions answered
        </div>
      </div>
    </div>
    <form id="active-quiz-modal-form" class="quiz-modal-form" novalidate>
      ${questionsHtml}
    </form>`;
}

// ─── Collect answers from the quiz form ───────────────────────────────────────
function collectAnswers(form, questions) {
  return questions.map(q => {
    if (q.type === "mcq") {
      const checked = form.querySelector(`input[name="q_${q._id}"]:checked`);
      return { questionId: q._id, selectedOptionIds: checked ? [checked.value] : [] };
    } else if (q.type === "multi_select") {
      const boxes = Array.from(form.querySelectorAll(`input[name="q_${q._id}"]:checked`));
      return { questionId: q._id, selectedOptionIds: boxes.map(b => b.value) };
    } else {
      const inp = form.querySelector(`input[name="q_${q._id}"]`);
      return { questionId: q._id, textAnswer: inp?.value.trim() || "" };
    }
  });
}

// ─── Result modal HTML ────────────────────────────────────────────────────────
function buildResultHtml(graded, passingScore) {
  const passed = graded?.passed ?? Boolean(graded?.isPassed);
  const pct    = graded?.percentage ?? graded?.score ?? 0;
  const pts    = `${graded?.score ?? graded?.awardedPoints ?? 0} / ${graded?.totalPoints ?? 0}`;
  const needed = passingScore ?? 50;

  return `
    <div class="quiz-result-body">
      ${scoreRing(Math.round(pct), passed)}
      <div class="quiz-result-info">
        <h3 class="quiz-result-title">${passed ? "🏆 Excellent work!" : "📊 Keep practising"}</h3>
        <p class="quiz-result-pts">${pts} points</p>
        <span class="status ${passed ? "completed" : "status-fail"}">
          ${passed ? "✓ PASSED" : "✕ NOT PASSED"}
        </span>
        <p class="quiz-result-note">Passing threshold: ${needed}%</p>
      </div>
    </div>`;
}

// ─── Main mount function ───────────────────────────────────────────────────────
export async function mountStudentQuizzes(container) {

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const availableCount = $("#available-quizzes-count", container);
  const availableEmpty = $("#available-quizzes-empty", container);
  const availableList  = $("#available-quizzes-list-container", container);

  const attemptsCount  = $("#attempts-count", container);
  const attemptsEmpty  = $("#attempts-empty", container);
  const attemptsList   = $("#attempts-list-container", container);

  const assignCount    = $("#assignments-count", container);
  const assignEmpty    = $("#assignments-empty", container);
  const assignList     = $("#assignments-list-container", container);

  // ── Load quiz attempts ────────────────────────────────────────────────────
  async function loadAttempts() {
    try {
      const payload  = await quizService.getMyAttempts();
      const attempts = payload?.data?.attempts || [];

      if (attemptsCount) attemptsCount.textContent = `${attempts.length} attempt${attempts.length !== 1 ? "s" : ""}`;
      if (attemptsEmpty) attemptsEmpty.hidden = attempts.length > 0;
      if (attemptsList)  attemptsList.hidden  = attempts.length === 0;

      if (attemptsList && attempts.length > 0) {
        attemptsList.innerHTML = attempts.map(att => {
          const passed     = att.passed !== undefined ? att.passed : Boolean(att.isPassed);
          const pct        = att.percentage ?? att.score ?? 0;
          const quizTitle  = att.quizId?.title || "Course Quiz";
          const courseTitle = att.quizId?.courseId?.title || "";
          const pts        = att.totalPoints ? `${att.score ?? att.awardedPoints ?? 0}/${att.totalPoints} pts` : "";
          const dateStr    = formatDate(att.submittedAt || att.createdAt || new Date());

          return `
            <article class="course-card-item${passed ? " is-completed-card" : ""}">
              <div class="quiz-attempt-ring">${scoreRing(Math.round(pct), passed)}</div>
              <div class="course-card-main">
                <div class="course-badges-row">
                  <span class="status ${passed ? "completed" : "status-fail"}">${passed ? "✓ Passed" : "✕ Not Passed"}</span>
                  ${pts ? `<span class="course-badge">${escapeHtml(pts)}</span>` : ""}
                  ${courseTitle ? `<span class="course-badge">${escapeHtml(courseTitle)}</span>` : ""}
                </div>
                <h3>${escapeHtml(quizTitle)}</h3>
                <p style="color:var(--muted); font-size:0.82rem;">Submitted on ${dateStr}</p>
              </div>
            </article>`;
        }).join("");
      }
    } catch (err) {
      toast(`Failed to load quiz attempts: ${errorText(err)}`, "error");
    }
  }

  // ── Load available quizzes ────────────────────────────────────────────────
  async function loadAvailableQuizzes() {
    try {
      const enrollRes   = await enrollmentService.getMyEnrollments();
      const enrollments = enrollRes?.data?.enrollments || [];

      if (!enrollments.length) {
        if (availableCount) availableCount.textContent = "0 quizzes";
        if (availableEmpty) availableEmpty.hidden = false;
        if (availableList)  availableList.hidden  = true;
        return;
      }

      const quizPromises = enrollments.map(async enr => {
        const cId    = enr.courseId?._id || enr.courseId;
        const cTitle = enr.courseId?.title || "Enrolled Course";
        try {
          const res     = await quizService.listCourseQuizzes(cId);
          const quizzes = (res?.data?.quizzes || []).filter(q => q.isPublished);
          return quizzes.map(q => ({ ...q, courseTitle: cTitle }));
        } catch { return []; }
      });

      const allQuizzes = (await Promise.all(quizPromises)).flat();

      if (availableCount) availableCount.textContent = `${allQuizzes.length} quiz${allQuizzes.length !== 1 ? "zes" : ""}`;
      if (availableEmpty) availableEmpty.hidden = allQuizzes.length > 0;
      if (availableList)  availableList.hidden  = allQuizzes.length === 0;

      if (availableList && allQuizzes.length > 0) {
        availableList.innerHTML = allQuizzes.map(quiz => {
          const qCount = quiz.questions?.length || 0;
          const limit  = quiz.timeLimitMinutes ?? 30;
          const pass   = quiz.passingScore ?? 50;
          return `
            <article class="course-card-item">
              <div class="course-card-main">
                <div class="course-badges-row">
                  <span class="status published">Published</span>
                  <span class="course-badge">🎯 ${qCount} Q</span>
                  <span class="course-badge">Pass: ${pass}%</span>
                  <span class="course-badge">⏱ ${limit} min</span>
                </div>
                <h3>${escapeHtml(quiz.title)}</h3>
                <p>${escapeHtml(quiz.instructions || "Curriculum knowledge check — answer all questions to verify your understanding.")}</p>
                <small style="color:var(--muted); font-size:0.79rem;">
                  Course: <strong style="color:var(--ink);">${escapeHtml(quiz.courseTitle)}</strong>
                </small>
              </div>
              <div class="course-actions">
                <button class="button button-primary mini-button" type="button"
                  data-take-quiz="${quiz._id}"
                  data-passing="${quiz.passingScore ?? 50}">
                  ✍️ Take Quiz
                </button>
              </div>
            </article>`;
        }).join("");
      }
    } catch (err) {
      toast(`Failed to load available quizzes: ${errorText(err)}`, "error");
    }
  }

  // ── Load assignments ──────────────────────────────────────────────────────
  async function loadAssignments() {
    try {
      const enrollRes   = await enrollmentService.getMyEnrollments();
      const enrollments = enrollRes?.data?.enrollments || [];

      // Fetch submissions to know what's already submitted
      let submissions = [];
      try {
        const subRes = await assignmentService.getMySubmissions();
        submissions  = subRes?.data?.submissions || [];
      } catch { /* non-critical */ }

      const submittedIds = new Set(submissions.map(s => s.assignmentId?._id || s.assignmentId));

      if (!enrollments.length) {
        if (assignCount) assignCount.textContent = "0 assignments";
        if (assignEmpty) assignEmpty.hidden = false;
        if (assignList)  assignList.hidden  = true;
        return;
      }

      const assignPromises = enrollments.map(async enr => {
        const cId    = enr.courseId?._id || enr.courseId;
        const cTitle = enr.courseId?.title || "Enrolled Course";
        try {
          const res  = await assignmentService.listCourseAssignments(cId);
          const list = res?.data?.assignments || [];
          return list.map(a => ({ ...a, courseTitle: cTitle, courseId: cId }));
        } catch { return []; }
      });

      const allAssignments = (await Promise.all(assignPromises)).flat();

      if (assignCount) assignCount.textContent = `${allAssignments.length} assignment${allAssignments.length !== 1 ? "s" : ""}`;
      if (assignEmpty) assignEmpty.hidden = allAssignments.length > 0;
      if (assignList)  assignList.hidden  = allAssignments.length === 0;

      if (assignList && allAssignments.length > 0) {
        assignList.innerHTML = allAssignments.map(asgn => {
          const isSubmitted = submittedIds.has(String(asgn._id));
          const sub         = submissions.find(s => String(s.assignmentId?._id || s.assignmentId) === String(asgn._id));
          const due         = asgn.dueDate ? formatDate(asgn.dueDate) : "No deadline";
          const isGraded    = sub?.grade !== null && sub?.grade !== undefined;

          let statusBadge;
          if (!isSubmitted)       statusBadge = `<span class="status in-progress">Pending</span>`;
          else if (!isGraded)     statusBadge = `<span class="status-badge-pending">⏳ Awaiting Grade</span>`;
          else                    statusBadge = `<span class="status-badge-graded">✓ Graded: ${sub.grade}/100</span>`;

          return `
            <article class="course-card-item${isSubmitted ? " is-completed-card" : ""}">
              <div class="course-card-main">
                <div class="course-badges-row">
                  ${statusBadge}
                  <span class="course-badge">📅 Due: ${escapeHtml(due)}</span>
                  <span class="course-badge">${escapeHtml(asgn.courseTitle)}</span>
                </div>
                <h3>${escapeHtml(asgn.title)}</h3>
                <p>${escapeHtml(asgn.description || "Complete and submit your assignment below.")}</p>
                ${isSubmitted && sub?.feedback ? `<p style="font-size:0.82rem; color:var(--violet-light); margin-top:0.5rem;">💬 "${escapeHtml(sub.feedback)}"</p>` : ""}
              </div>
              <div class="course-actions">
                ${isSubmitted
                  ? `<button class="button button-secondary mini-button" disabled>✓ Submitted</button>`
                  : `<button class="button button-primary mini-button" type="button"
                       data-submit-assignment="${asgn._id}"
                       data-assignment-title="${escapeHtml(asgn.title)}">
                       📤 Submit
                     </button>`}
              </div>
            </article>`;
        }).join("");
      }
    } catch (err) {
      toast(`Failed to load assignments: ${errorText(err)}`, "error");
    }
  }

  // ── Quiz & Assignment click handler ─────────────────────────────────────────
  container.addEventListener("click", async event => {
    // --- Take Quiz ---
    const takeBtn = event.target.closest("[data-take-quiz]");
    if (takeBtn) {
      const quizId      = takeBtn.dataset.takeQuiz;
      const passingScore = Number(takeBtn.dataset.passing || 50);
      setBusy(takeBtn, true, "Starting…");

      try {
        const payload = await quizService.startAttempt(quizId);
        const attempt = payload?.data?.attempt;
        const quiz    = payload?.data?.quiz;

        if (!attempt || !quiz) throw new Error("Unable to start quiz attempt.");

        const modal = openModal({
          title       : `✍️ ${escapeHtml(quiz.title)}`,
          contentHtml : buildQuizHtml(quiz),
          confirmText : "Submit Quiz 🚀",
          onConfirm   : async (backdrop, close) => {
            const form       = backdrop.querySelector("#active-quiz-modal-form");
            const confirmBtn = backdrop.querySelector(".modal-confirm");
            if (confirmBtn) setBusy(confirmBtn, true, "Grading…");

            try {
              const answers   = collectAnswers(form, quiz.questions || []);
              const submitRes = await quizService.submitAttempt(attempt._id, answers);
              const graded    = submitRes?.data?.attempt || submitRes?.data || {};

              close();

              openModal({
                title       : graded?.passed ? "🎉 Quiz Passed!" : "📝 Quiz Completed",
                contentHtml : buildResultHtml(graded, passingScore),
                confirmText : "Done",
                onConfirm   : (_, mClose) => mClose()
              });

              await loadAttempts();
            } catch (err) {
              toast(`Failed to submit quiz: ${errorText(err)}`, "error");
              if (confirmBtn) setBusy(confirmBtn, false);
            }
          }
        });

        // ── Interactive radio/checkbox styling & progress tracker ────────────
        const formEl = modal.element?.querySelector("#active-quiz-modal-form");
        if (formEl) {
          const updateTracker = () => {
            const tracker = modal.element?.querySelector("#quiz-answered-tracker");
            if (!tracker) return;
            const questions = quiz.questions || [];
            let answered = 0;
            questions.forEach(q => {
              if (q.type === "mcq" || q.type === "multi_select") {
                if (formEl.querySelector(`input[name="q_${q._id}"]:checked`)) answered++;
              } else {
                if (formEl.querySelector(`input[name="q_${q._id}"]`)?.value.trim()) answered++;
              }
            });
            tracker.textContent = `Progress: ${answered} / ${questions.length} questions answered`;
          };

          formEl.addEventListener("change", (e) => {
            if (e.target.matches(".quiz-option-input")) {
              const list = e.target.closest(".quiz-options-list");
              if (list) {
                list.querySelectorAll(".quiz-option-label").forEach((lbl) => {
                  const inp = lbl.querySelector(".quiz-option-input");
                  lbl.classList.toggle("is-selected", Boolean(inp?.checked));
                });
              }
            }
            updateTracker();
          });

          formEl.addEventListener("input", (e) => {
            if (e.target.matches(".quiz-short-input")) {
              updateTracker();
            }
          });
        }
      } catch (err) {
        toast(`Could not start quiz: ${errorText(err)}`, "error");
      } finally {
        setBusy(takeBtn, false);
      }
      return;
    }

    // --- Submit Assignment ---
    const submitBtn = event.target.closest("[data-submit-assignment]");
    if (submitBtn) {
      const assignmentId    = submitBtn.dataset.submitAssignment;
      const assignmentTitle = submitBtn.dataset.assignmentTitle || "Assignment";

      openModal({
        title: `📤 Submit: ${escapeHtml(assignmentTitle)}`,
        contentHtml: `
          <div class="assignment-submit-form">
            <label class="assignment-submit-label" for="assign-file-url">
              Submission Link <span style="color:#ff9b9b;">*</span>
              <small style="color:var(--muted); display:block; margin-top:0.2rem;">
                Paste a Google Drive, GitHub, or any public URL to your work.
              </small>
            </label>
            <input type="url" id="assign-file-url" class="assignment-submit-input"
              placeholder="https://drive.google.com/your-file" autocomplete="off" />

            <label class="assignment-submit-label" for="assign-notes" style="margin-top:1rem;">
              Notes for instructor <small style="color:var(--muted);">(optional)</small>
            </label>
            <textarea id="assign-notes" class="notes-textarea"
              style="min-height:90px;"
              placeholder="Any context or notes about your submission…"></textarea>
          </div>`,
        confirmText: "Submit Assignment ✓",
        onConfirm: async (backdrop, close) => {
          const fileUrl = backdrop.querySelector("#assign-file-url")?.value.trim();
          const notes   = backdrop.querySelector("#assign-notes")?.value.trim();
          const btn     = backdrop.querySelector(".modal-confirm");

          if (!fileUrl) {
            toast("Please paste a submission link.", "error");
            return;
          }

          if (btn) setBusy(btn, true, "Submitting…");

          try {
            await assignmentService.submitAssignment(assignmentId, { fileUrl, notes });
            toast("Assignment submitted successfully! 🎉");
            close();
            await loadAssignments();
          } catch (err) {
            toast(`Submission failed: ${errorText(err)}`, "error");
            if (btn) setBusy(btn, false);
          }
        }
      });
      return;
    }
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  await Promise.all([
    loadAvailableQuizzes(),
    loadAttempts(),
    loadAssignments()
  ]);
}
