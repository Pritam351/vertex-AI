import { enrollmentService } from "../../services/enrollmentService.js";
import { assignmentService } from "../../services/assignmentService.js";
import { certificateService } from "../../services/certificateService.js";
import { gamificationService } from "../../services/gamificationService.js";
import { openCertificateModal } from "../../components/common/certificate-modal.js";
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
  const statCertCard = $("#stat-cert-card", container);
  const statStreak = $("#stat-streak", container);
  const statStreakSub = $("#stat-streak-sub", container);

  const recContainer = $("#recommendations-container", container);
  const badgesContainer = $("#badges-grid-container", container);
  const badgesCount = $("#student-badges-count", container);

  const subsCount = $("#student-submissions-count", container);
  const subsEmpty = $("#student-submissions-empty", container);
  const subsWrapper = $("#student-submissions-wrapper", container);
  const subsTbody = $("#student-submissions-tbody", container);

  // Navigate to certificates on stat card click
  statCertCard?.addEventListener("click", () => {
    window.location.hash = "#/student/certificates";
  });

  // ── 1. Load Enrollments & Certificates ─────────────────────────────────────
  let certificatesMap = new Map();
  try {
    const [enrollPayload, certPayload] = await Promise.allSettled([
      enrollmentService.getMyEnrollments(),
      certificateService.getMyCertificates(),
    ]);

    const enrollments =
      enrollPayload.status === "fulfilled"
        ? enrollPayload.value?.data?.enrollments || []
        : [];

    const certificates =
      certPayload.status === "fulfilled"
        ? certPayload.value?.data?.certificates || certPayload.value?.certificates || []
        : [];

    certificates.forEach((c) => {
      const cId = c.courseId?._id || c.courseId;
      if (cId) certificatesMap.set(String(cId), c);
    });

    const total = enrollments.length;
    const completed = enrollments.filter(
      (e) => (e.progressPercent || 0) >= 100
    ).length;
    const active = total - completed;

    if (statEnrolled) statEnrolled.textContent = total;
    if (statActive) statActive.textContent = active;
    if (statCompleted) statCompleted.textContent = Math.max(completed, certificates.length);
    if (enrolledCount) enrolledCount.textContent = `${total} enrolled`;

    if (enrolledEmpty) enrolledEmpty.hidden = total > 0;

    if (enrolledList) {
      if (total === 0) {
        enrolledList.innerHTML = "";
        enrolledList.hidden = true;
      } else {
        enrolledList.hidden = false;
        enrolledList.innerHTML = enrollments
          .map((enrollment) => {
            const course = enrollment.courseId || {};
            const courseIdStr = String(course._id || enrollment.courseId);
            const percent = Math.min(100, Math.max(0, Math.round(enrollment.progressPercent || 0)));
            const isCompleted = percent === 100;
            const existingCert = certificatesMap.get(courseIdStr);

            return `
              <article class="enrolled-course-card${isCompleted ? " is-completed-card" : ""}">
                <div class="enrolled-course-info">
                  <div class="course-badges-row">
                    <span class="course-badge">${escapeHtml(course.category || "General")}</span>
                    <span class="status ${isCompleted ? "completed" : "in-progress"}">${isCompleted ? "✓ Completed" : "In Progress"}</span>
                  </div>
                  <h3>${escapeHtml(course.title || "Course")}</h3>
                  <p>${escapeHtml(course.description || "Continue your lessons and quizzes.")}</p>
                  <div class="progress-bar-wrapper" style="margin-top: 0.75rem; max-width: 440px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.35rem;">
                      <span>Progress</span>
                      <strong style="color:${isCompleted ? "var(--aqua)" : "inherit"}">${percent}%</strong>
                    </div>
                    <div style="background:var(--line); border-radius:999px; height:8px; overflow:hidden;">
                      <div style="background:${isCompleted ? "linear-gradient(90deg,#52d8c2,#8cedc9)" : "linear-gradient(90deg, var(--violet), var(--aqua))"}; width:${percent}%; height:100%; border-radius:999px; transition:width 0.3s ease;"></div>
                    </div>
                  </div>
                </div>

                <div class="enrolled-course-actions">
                  <a class="button ${isCompleted ? "button-secondary" : "button-primary"} mini-button" href="#/student/player?courseId=${escapeHtml(courseIdStr)}">
                    ${isCompleted ? "Review Course →" : "Continue Learning →"}
                  </a>
                  ${
                    isCompleted
                      ? `
                    <button type="button" class="button button-primary mini-button btn-claim-or-view-cert" data-course-id="${escapeHtml(courseIdStr)}" data-course-title="${escapeHtml(course.title || "Course")}">
                      ${existingCert ? "🎓 View Certificate" : "🎓 Claim Certificate"}
                    </button>
                  `
                      : ""
                  }
                </div>
              </article>
            `;
          })
          .join("");

        // Bind Certificate Actions
        enrolledList.querySelectorAll(".btn-claim-or-view-cert").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const cId = btn.dataset.courseId;
            const cTitle = btn.dataset.courseTitle;
            let cert = certificatesMap.get(cId);

            if (cert) {
              openCertificateModal(cert);
              return;
            }

            // Request certificate issuance from backend
            const origText = btn.textContent;
            btn.textContent = "Issuing…";
            btn.disabled = true;

            try {
              const res = await certificateService.issueCertificate(cId);
              const newCert = res?.data?.certificate || res?.certificate || res;
              toast("Congratulations! Your Certificate of Completion has been issued! 🎓");
              certificatesMap.set(cId, newCert);
              btn.textContent = "🎓 View Certificate";
              btn.disabled = false;
              openCertificateModal(newCert);

              // Update completed counter
              if (statCompleted) {
                const cur = Number(statCompleted.textContent) || 0;
                statCompleted.textContent = Math.max(cur, certificatesMap.size);
              }
            } catch (err) {
              btn.textContent = origText;
              btn.disabled = false;
              toast(`Could not issue certificate: ${errorText(err)}`, "error");
            }
          });
        });
      }
    }
  } catch (error) {
    toast(`Failed to load enrollments: ${errorText(error)}`, "error");
  }

  // ── 2. Load Streak & Gamification ──────────────────────────────────────────
  try {
    const streakRes = await gamificationService.getMyStreak();
    const streak = streakRes?.data || streakRes;
    const current = Number(streak?.currentStreak || 0);
    const longest = Number(streak?.longestStreak || current);

    if (statStreak) statStreak.textContent = `🔥 ${current}d`;
    if (statStreakSub) statStreakSub.textContent = `Personal Best: ${longest}d streak`;
  } catch {
    if (statStreak) statStreak.textContent = "🔥 0d";
  }

  // ── 3. Load Badges & Milestones ────────────────────────────────────────────
  try {
    const badgesRes = await gamificationService.getMyBadges();
    const bData = badgesRes?.data || badgesRes;
    const badges = bData?.badges || [];
    const earnedCount = bData?.earnedCount ?? badges.filter((b) => b.isEarned).length;

    if (badgesCount) {
      badgesCount.textContent = `${earnedCount} / ${badges.length} Earned`;
    }

    if (badgesContainer) {
      if (!badges.length) {
        badgesContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem;">Complete lessons and quizzes to earn achievements.</p>`;
      } else {
        badgesContainer.innerHTML = badges
          .map((b) => {
            const isEarned = !!b.isEarned;
            return `
              <div class="panel" style="padding:1rem; border-color:${isEarned ? "rgba(139, 92, 246, 0.45)" : "var(--line)"}; background:${isEarned ? "rgba(22, 27, 60, 0.6)" : "rgba(15, 23, 42, 0.3)"}; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <span style="font-size:1.8rem; filter:${isEarned ? "drop-shadow(0 0 8px rgba(167,139,250,0.5))" : "grayscale(1) opacity(0.5)"};">${b.icon}</span>
                    <span style="font-size:0.7rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:999px; ${isEarned ? "background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);" : "background:rgba(255,255,255,0.05); color:var(--muted);"}">
                      ${isEarned ? "✓ Unlocked" : "🔒 Locked"}
                    </span>
                  </div>
                  <h4 style="margin:0 0 0.25rem 0; font-size:0.95rem; color:${isEarned ? "#f8fafc" : "#94a3b8"};">${escapeHtml(b.name)}</h4>
                  <p style="margin:0; font-size:0.78rem; color:var(--muted); line-height:1.4;">${escapeHtml(b.description)}</p>
                </div>
                <div style="margin-top:0.75rem; font-size:0.72rem; font-family:'DM Mono', monospace; color:${isEarned ? "#c084fc" : "var(--muted)"};">
                  ${escapeHtml(b.progress || "")}
                </div>
              </div>
            `;
          })
          .join("");
      }
    }
  } catch {
    if (badgesContainer) {
      badgesContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem;">Milestones will display here once you complete lessons and assessments.</p>`;
    }
  }

  // ── 4. Load AI Course Recommendations ──────────────────────────────────────
  try {
    const recRes = await gamificationService.getMyRecommendations();
    const rData = recRes?.data || recRes;
    const recommendations = rData?.recommendations || [];

    if (recContainer) {
      if (!recommendations.length) {
        recContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem; padding:1rem 0;">You are enrolled in all currently featured courses! Check back soon for new topics.</p>`;
      } else {
        recContainer.innerHTML = recommendations
          .map((rec) => {
            return `
              <article class="recommendation-card">
                <div>
                  <div class="rec-badge-row">
                    <span class="course-badge">${escapeHtml(rec.category)}</span>
                    <span class="rec-match-pill">⚡ ${rec.matchScore}% Match</span>
                  </div>
                  <h3 class="rec-title">${escapeHtml(rec.title)}</h3>
                  <p class="rec-desc">${escapeHtml(rec.description || "")}</p>
                  <p class="rec-reason">💡 ${escapeHtml(rec.reason)}</p>
                </div>
                <div style="margin-top:0.75rem;">
                  <a class="button button-primary mini-button" href="#/student/catalog" style="width:100%; justify-content:center;">
                    Explore Course →
                  </a>
                </div>
              </article>
            `;
          })
          .join("");
      }
    }
  } catch {
    if (recContainer) {
      recContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem;">Recommendations will update as you complete more course modules.</p>`;
    }
  }

  // ── 5. Load and render student's assignment submissions ─────────────────────
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
