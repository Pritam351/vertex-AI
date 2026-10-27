import { enrollmentService } from "../../services/enrollmentService.js";
import { getUser } from "../../store/session.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { errorText } from "../../utils/validation.js";

export async function mountStudentDashboard(container) {
  const user = getUser();
  const welcomeName = $("#student-welcome-name", container);
  if (welcomeName && user?.fullName) {
    welcomeName.textContent = user.fullName.split(" ")[0];
  }

  const enrolledCount = $("#enrolled-count", container);
  const enrolledEmpty = $("#enrolled-empty", container);
  const enrolledList = $("#enrolled-list-container", container);
  const statEnrolled = $("#stat-enrolled", container);
  const statActive = $("#stat-active", container);
  const statCompleted = $("#stat-completed", container);

  try {
    const payload = await enrollmentService.getMyEnrollments();
    const enrollments = payload?.data?.enrollments || [];

    const total = enrollments.length;
    const completed = enrollments.filter((e) => (e.progressPercent || 0) >= 100).length;
    const active = total - completed;

    if (statEnrolled) statEnrolled.textContent = total;
    if (statActive) statActive.textContent = active;
    if (statCompleted) statCompleted.textContent = completed;
    if (enrolledCount) enrolledCount.textContent = `${total} enrolled`;

    if (enrolledEmpty) enrolledEmpty.hidden = total > 0;

    if (enrolledList) {
      if (total === 0) {
        enrolledList.innerHTML = "";
      } else {
        enrolledList.innerHTML = enrollments
          .map((enrollment) => {
            const course = enrollment.courseId || {};
            const percent = Math.min(100, Math.max(0, Math.round(enrollment.progressPercent || 0)));
            return `
              <article class="course-card-item">
                ${
                  course.thumbnailUrl
                    ? `
                  <div class="course-card-thumb">
                    <img src="${escapeHtml(course.thumbnailUrl)}" alt="${escapeHtml(course.title || "Course")}" loading="lazy" onerror="this.onerror=null; this.parentElement.style.display='none';" />
                  </div>
                `
                    : ""
                }
                <div class="course-card-main">
                  <div class="course-badges-row">
                    <span class="course-badge">${escapeHtml(course.category || "General")}</span>
                    <span class="status ${percent === 100 ? "published" : "pending"}">${percent === 100 ? "Completed" : "In Progress"}</span>
                  </div>
                  <h3>${escapeHtml(course.title || "Course")}</h3>
                  <p>${escapeHtml(course.description || "Continue your lessons and quizzes.")}</p>
                  <div class="progress-bar-wrapper" style="margin-top: 1rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.35rem;">
                      <span>Progress</span>
                      <strong>${percent}%</strong>
                    </div>
                    <div style="background:var(--line); border-radius:999px; height:8px; overflow:hidden;">
                      <div style="background:linear-gradient(90deg, var(--violet), var(--aqua)); width:${percent}%; height:100%; border-radius:999px; transition:width 0.3s ease;"></div>
                    </div>
                  </div>
                </div>
                <div class="course-actions">
                  <a class="button button-primary mini-button" href="#/student/player?courseId=${escapeHtml(course._id || enrollment.courseId)}">
                    Continue Learning →
                  </a>
                </div>
              </article>
            `;
          })
          .join("");
      }
    }
  } catch (error) {
    toast(`Failed to load enrollments: ${errorText(error)}`, "error");
  }
}
