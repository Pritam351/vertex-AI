import { enrollmentService } from "../../services/enrollmentService.js";
import { assignmentService } from "../../services/assignmentService.js";
import { getUser } from "../../store/session.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";
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

  const subsCount = $("#student-submissions-count", container);
  const subsEmpty = $("#student-submissions-empty", container);
  const subsWrapper = $("#student-submissions-wrapper", container);
  const subsTbody = $("#student-submissions-tbody", container);

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
                    <img src="${escapeHtml(course.thumbnailUrl)}" alt="${escapeHtml(course.title || "Course")}" loading="lazy" onerror="this.parentElement.style.display='none';" />
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

  // Load and render student's assignment submissions
  try {
    const subPayload = await assignmentService.getMySubmissions();
    const submissions = subPayload?.data?.submissions || [];

    if (subsCount) {
      subsCount.textContent = `${submissions.length} submitted`;
    }

    if (submissions.length === 0) {
      if (subsEmpty) subsEmpty.hidden = false;
      if (subsWrapper) subsWrapper.hidden = true;
    } else {
      if (subsEmpty) subsEmpty.hidden = true;
      if (subsWrapper) subsWrapper.hidden = false;

      if (subsTbody) {
        subsTbody.innerHTML = submissions
          .map((sub) => {
            const assignment = sub.assignmentId || {};
            const course = assignment.courseId || {};
            const assignmentTitle = assignment.title || "Assignment";
            const courseTitle = course.title || "Enrolled Course";
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
              : `<span style="color:var(--muted); font-size:0.8rem;">No link</span>`;

            const feedbackDisplay = sub.feedback
              ? `<span style="color:#e2e8f0; font-size:0.85rem;">“${escapeHtml(sub.feedback)}”</span>`
              : `<span style="color:var(--muted); font-size:0.8rem;">Awaiting instructor feedback</span>`;

            return `
              <tr>
                <td>
                  <div style="display:flex; flex-direction:column; gap:0.2rem;">
                    <strong style="color:#f8fafc;">${escapeHtml(assignmentTitle)}</strong>
                    <span style="font-size:0.75rem; color:var(--violet-light);">${escapeHtml(courseTitle)}</span>
                  </div>
                </td>
                <td>
                  <span style="font-family:'DM Mono',monospace; font-size:0.8rem; color:#fca5a5;">📅 ${dueDateDisplay}</span>
                </td>
                <td>
                  <span style="font-family:'DM Mono',monospace; font-size:0.8rem; color:var(--muted);">🕒 ${submittedDate}</span>
                </td>
                <td>${statusBadge}</td>
                <td>${workLink}</td>
                <td>${feedbackDisplay}</td>
              </tr>
            `;
          })
          .join("");
      }
    }
  } catch (err) {
    console.warn("Could not load student submissions:", err);
  }
}
