import { quizService } from "../../services/quizService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { openModal } from "../../components/common/modal.js";
import { errorText } from "../../utils/validation.js";

export async function mountStudentQuizzes(container) {
  const attemptsCount = $("#attempts-count", container);
  const attemptsEmpty = $("#attempts-empty", container);
  const attemptsList = $("#attempts-list-container", container);

  const availableCount = $("#available-quizzes-count", container);
  const availableEmpty = $("#available-quizzes-empty", container);
  const availableList = $("#available-quizzes-list-container", container);

  async function loadAttempts() {
    try {
      const payload = await quizService.getMyAttempts();
      const attempts = payload?.data?.attempts || [];

      if (attemptsCount) {
        attemptsCount.textContent =
          attempts.length === 1 ? "1 attempt" : `${attempts.length} attempts`;
      }
      if (attemptsEmpty) attemptsEmpty.hidden = attempts.length > 0;

      if (attemptsList) {
        if (attempts.length === 0) {
          attemptsList.innerHTML = "";
        } else {
          attemptsList.innerHTML = attempts
            .map((att) => {
              const isPassed = att.passed !== undefined ? att.passed : Boolean(att.isPassed);
              const score =
                att.percentage !== undefined
                  ? `${att.percentage}%`
                  : att.score !== undefined
                  ? `${att.score}%`
                  : "Pending";
              const quizTitle = att.quizId?.title || "Course Quiz";
              const pointsInfo =
                att.totalPoints !== undefined
                  ? `${att.score ?? att.awardedPoints ?? 0}/${att.totalPoints} pts`
                  : "";
              return `
                <article class="course-card-item">
                  <div class="course-card-main">
                    <div class="course-badges-row">
                      <span class="status ${isPassed ? "published" : "rejected"}">${isPassed ? "Passed ✓" : "Not Passed ✕"}</span>
                      <span class="course-badge">Score: ${score}</span>
                      ${pointsInfo ? `<span class="course-badge">${pointsInfo}</span>` : ""}
                    </div>
                    <h3>${escapeHtml(quizTitle)}</h3>
                    <p>Submitted on ${formatDate(att.submittedAt || att.createdAt || new Date())}</p>
                  </div>
                </article>
              `;
            })
            .join("");
        }
      }
    } catch (error) {
      toast(`Failed to load quiz attempts: ${errorText(error)}`, "error");
    }
  }

  async function loadAvailableQuizzes() {
    try {
      const enrollRes = await enrollmentService.getMyEnrollments();
      const enrollments = enrollRes?.data?.enrollments || [];

      if (!enrollments.length) {
        if (availableCount) availableCount.textContent = "0 quizzes";
        if (availableEmpty) availableEmpty.hidden = false;
        if (availableList) availableList.innerHTML = "";
        return;
      }

      // Fetch published quizzes for each enrolled course
      const quizPromises = enrollments.map(async (enr) => {
        const course = enr.courseId;
        const cId = course?._id || course;
        const cTitle = course?.title || "Enrolled Course";
        try {
          const res = await quizService.listCourseQuizzes(cId);
          const quizzes = (res?.data?.quizzes || []).filter((q) => q.isPublished);
          return quizzes.map((q) => ({ ...q, courseTitle: cTitle }));
        } catch {
          return [];
        }
      });

      const results = await Promise.all(quizPromises);
      const allQuizzes = results.flat();

      if (availableCount) {
        availableCount.textContent =
          allQuizzes.length === 1 ? "1 quiz" : `${allQuizzes.length} quizzes`;
      }
      if (availableEmpty) availableEmpty.hidden = allQuizzes.length > 0;

      if (availableList) {
        if (allQuizzes.length === 0) {
          availableList.innerHTML = "";
        } else {
          availableList.innerHTML = allQuizzes
            .map((quiz) => {
              const qCount = quiz.questions?.length || 0;
              return `
                <article class="course-card-item">
                  <div class="course-card-main">
                    <div class="course-badges-row">
                      <span class="status published">Published</span>
                      <span class="course-badge">${qCount} Questions</span>
                      <span class="course-badge">Pass: ${quiz.passingScore ?? 50}%</span>
                      <span class="course-badge">⏱ ${quiz.timeLimitMinutes ?? 30} mins</span>
                    </div>
                    <h3>${escapeHtml(quiz.title)}</h3>
                    <p>${escapeHtml(quiz.instructions || "Curriculum knowledge check. Answer all questions to verify your understanding.")}</p>
                    <small style="color:var(--muted); font-size:0.8rem;">Course: <strong>${escapeHtml(quiz.courseTitle)}</strong></small>
                  </div>
                  <div class="course-actions">
                    <button class="button button-primary" type="button" data-take-quiz="${quiz._id}" style="padding:0.6rem 1.1rem;">
                      ✍️ Take Quiz
                    </button>
                  </div>
                </article>
              `;
            })
            .join("");
        }
      }
    } catch (error) {
      toast(`Failed to load available quizzes: ${errorText(error)}`, "error");
    }
  }

  // Handle "Take Quiz" click delegation
  container.addEventListener("click", async (event) => {
    const takeBtn = event.target.closest("[data-take-quiz]");
    if (!takeBtn) return;

    const quizId = takeBtn.dataset.takeQuiz;
    setBusy(takeBtn, true, "Starting quiz…");

    try {
      const payload = await quizService.startAttempt(quizId);
      const attempt = payload.data?.attempt;
      const quiz = payload.data?.quiz;

      if (!attempt || !quiz) {
        throw new Error("Unable to start quiz attempt.");
      }

      const questions = quiz.questions || [];
      const questionsHtml = questions
        .map((q, idx) => {
          const num = idx + 1;
          const isSingle = q.type === "mcq";
          const isMulti = q.type === "multi_select";
          const isShort = q.type === "short_answer";

          let inputHtml = "";
          if (isShort) {
            inputHtml = `
              <div style="margin-top:0.65rem;">
                <input type="text" name="q_${q._id}" class="generator-input" placeholder="Type your answer here..." style="width:100%; padding:0.65rem 0.85rem;" />
              </div>
            `;
          } else {
            const inputType = isSingle ? "radio" : "checkbox";
            const options = q.options || [];
            inputHtml = `
              <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.65rem;">
                ${options
                  .map(
                    (opt) => `
                  <label style="display:flex; align-items:center; gap:0.65rem; padding:0.6rem 0.85rem; border-radius:0.4rem; background:rgba(255,255,255,0.03); border:1px solid var(--line); cursor:pointer;">
                    <input type="${inputType}" name="q_${q._id}" value="${opt._id}" style="cursor:pointer;" />
                    <span style="color:#f8fafc; font-size:0.9rem;">${escapeHtml(opt.text)}</span>
                  </label>
                `
                  )
                  .join("")}
              </div>
            `;
          }

          return `
            <div style="padding:1.1rem; border-radius:0.6rem; background:#11192d; border:1px solid #27314b; margin-bottom:1.1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem;">
                <span style="font-size:0.75rem; font-weight:700; color:#a78bfa; text-transform:uppercase;">Question ${num} • ${q.points || 1} pt</span>
                <span class="status pending" style="font-size:0.7rem;">${isSingle ? "Single Choice" : isMulti ? "Multi-Select" : "Short Answer"}</span>
              </div>
              <p style="font-size:0.95rem; font-weight:600; color:#ffffff; margin:0 0 0.5rem;">${escapeHtml(q.text)}</p>
              ${inputHtml}
            </div>
          `;
        })
        .join("");

      const contentHtml = `
        <div style="max-height:65vh; overflow-y:auto; padding-right:0.5rem;">
          <div style="margin-bottom:1rem; padding:0.75rem; border-radius:0.4rem; background:rgba(124,58,237,0.1); border:1px solid rgba(167,139,250,0.3);">
            <strong style="color:#d8b4fe; display:block; font-size:0.85rem; margin-bottom:0.2rem;">⏱ Instructions:</strong>
            <p style="margin:0; font-size:0.82rem; color:#cbd5e1;">${escapeHtml(quiz.instructions || "Answer all questions to the best of your ability and click Submit Quiz when finished.")}</p>
          </div>
          <form id="active-quiz-modal-form">
            ${questionsHtml}
          </form>
        </div>
      `;

      openModal({
        title: `✍️ ${escapeHtml(quiz.title)}`,
        contentHtml,
        confirmText: "Submit Quiz 🚀",
        onConfirm: async (backdrop, close) => {
          const form = backdrop.querySelector("#active-quiz-modal-form");
          const confirmBtn = backdrop.querySelector(".modal-confirm");
          if (confirmBtn) setBusy(confirmBtn, true, "Submitting & Grading…");

          try {
            const answers = questions.map((q) => {
              if (q.type === "mcq") {
                const checked = form.querySelector(`input[name="q_${q._id}"]:checked`);
                return {
                  questionId: q._id,
                  selectedOptionIds: checked ? [checked.value] : []
                };
              } else if (q.type === "multi_select") {
                const checkedBoxes = Array.from(
                  form.querySelectorAll(`input[name="q_${q._id}"]:checked`)
                );
                return {
                  questionId: q._id,
                  selectedOptionIds: checkedBoxes.map((cb) => cb.value)
                };
              } else {
                const input = form.querySelector(`input[name="q_${q._id}"]`);
                return {
                  questionId: q._id,
                  textAnswer: input ? input.value.trim() : ""
                };
              }
            });

            const submitRes = await quizService.submitAttempt(attempt._id, answers);
            const graded = submitRes?.data?.attempt || submitRes?.data || {};

            close();

            const isPassed = graded?.passed !== undefined ? graded.passed : Boolean(graded?.isPassed);
            const score = graded?.percentage !== undefined ? graded.percentage : (graded?.score ?? 0);
            const pts = `${graded?.score ?? graded?.awardedPoints ?? 0}/${graded?.totalPoints ?? 0}`;

            openModal({
              title: isPassed ? "🎉 Quiz Passed!" : "📝 Quiz Completed",
              contentHtml: `
                <div style="text-align:center; padding:1.5rem 0.5rem;">
                  <div style="font-size:3.5rem; margin-bottom:0.75rem;">${isPassed ? "🏆" : "📊"}</div>
                  <h3 style="font-size:1.4rem; color:#ffffff; margin:0 0 0.5rem;">Your Score: ${score}%</h3>
                  <p style="font-size:0.95rem; color:var(--muted); margin:0 0 1rem;">Awarded ${pts} points</p>
                  <span class="status ${isPassed ? "published" : "rejected"}" style="font-size:0.9rem; padding:0.4rem 1rem;">
                    ${isPassed ? "PASSED (Passed Requirement Met) ✓" : "NOT PASSED (Try Again) ✕"}
                  </span>
                </div>
              `,
              confirmText: "Done",
              onConfirm: (mBackdrop, mClose) => mClose()
            });

            await loadAttempts();
          } catch (err) {
            toast(`Failed to submit quiz: ${errorText(err)}`, "error");
            if (confirmBtn) setBusy(confirmBtn, false);
          }
        }
      });
    } catch (err) {
      toast(`Could not start quiz: ${errorText(err)}`, "error");
    } finally {
      setBusy(takeBtn, false);
    }
  });

  // Initial load
  await Promise.all([loadAvailableQuizzes(), loadAttempts()]);
}
