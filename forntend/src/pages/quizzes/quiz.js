import { quizService } from "../../services/quizService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";
import { toast } from "../../components/common/toast.js";
import { errorText } from "../../utils/validation.js";

export async function mountStudentQuizzes(container) {
  const attemptsCount = $("#attempts-count", container);
  const attemptsEmpty = $("#attempts-empty", container);
  const attemptsList = $("#attempts-list-container", container);

  try {
    const payload = await quizService.getMyAttempts();
    const attempts = payload?.data?.attempts || [];

    if (attemptsCount) {
      attemptsCount.textContent = attempts.length === 1 ? "1 attempt" : `${attempts.length} attempts`;
    }
    if (attemptsEmpty) attemptsEmpty.hidden = attempts.length > 0;

    if (attemptsList) {
      if (attempts.length === 0) {
        attemptsList.innerHTML = "";
      } else {
        attemptsList.innerHTML = attempts
          .map((att) => {
            const isPassed = att.isPassed;
            const score = att.score !== undefined ? `${att.score}%` : "Pending";
            const quizTitle = att.quizId?.title || "Course Quiz";
            return `
              <article class="course-card-item">
                <div class="course-card-main">
                  <div class="course-badges-row">
                    <span class="status ${isPassed ? "published" : "rejected"}">${isPassed ? "Passed" : "Not Passed"}</span>
                    <span class="course-badge">Score: ${score}</span>
                  </div>
                  <h3>${escapeHtml(quizTitle)}</h3>
                  <p>Attempted on ${formatDate(att.createdAt || att.submittedAt)}</p>
                </div>
              </article>
            `;
          })
          .join("");
      }
    }
  } catch (error) {
    toast(`Failed to load attempts: ${errorText(error)}`, "error");
  }
}
