import { courseService } from "../../services/courseService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { errorText } from "../../utils/validation.js";

export async function mountAdminDashboard(container) {
  const statPending = $("#admin-stat-pending", container);
  try {
    const payload = await courseService.getPendingCourses();
    const count = payload?.data?.courses?.length || 0;
    if (statPending) statPending.textContent = count;
  } catch (error) {
    console.error("Could not load admin stats:", error);
  }
}

export async function mountAdminCourses(container) {
  const listContainer = $("#pending-list-container", container);
  const countEl = $("#pending-count", container);
  const emptyEl = $("#pending-empty", container);

  async function loadPending() {
    try {
      const payload = await courseService.getPendingCourses();
      const courses = payload?.data?.courses || [];

      if (countEl) countEl.textContent = `${courses.length} pending`;
      if (emptyEl) emptyEl.hidden = courses.length > 0;

      if (listContainer) {
        if (!courses.length) {
          listContainer.innerHTML = "";
        } else {
          listContainer.innerHTML = courses
            .map((c) => {
              const instructor = c.instructorId?.fullName || "Instructor";
              return `
                <article class="course-card-item">
                  ${
                    c.thumbnailUrl
                      ? `
                    <div class="course-card-thumb">
                      <img src="${escapeHtml(c.thumbnailUrl)}" alt="${escapeHtml(c.title)}" loading="lazy" onerror="this.onerror=null; this.parentElement.style.display='none';" />
                    </div>
                  `
                      : ""
                  }
                  <div class="course-card-main">
                    <div class="course-badges-row">
                      <span class="course-badge">${escapeHtml(c.category || "General")}</span>
                      <span class="status pending">Pending Approval</span>
                    </div>
                    <h3>${escapeHtml(c.title)}</h3>
                    <p>${escapeHtml(c.description || "No description added.")}</p>
                    <small style="color:var(--muted);">Submitted by: <strong>${escapeHtml(instructor)}</strong></small>
                  </div>
                  <div class="course-actions" style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="button button-primary mini-button" type="button" data-review-id="${c._id}" data-decision="approved">
                      Approve ✓
                    </button>
                    <button class="button button-secondary mini-button" type="button" data-review-id="${c._id}" data-decision="rejected" style="border-color:var(--danger); color:var(--danger);">
                      Reject ✕
                    </button>
                  </div>
                </article>
              `;
            })
            .join("");
        }
      }
    } catch (error) {
      toast(`Failed to load pending courses: ${errorText(error)}`, "error");
    }
  }

  listContainer?.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-review-id]");
    if (!button) return;

    const courseId = button.dataset.reviewId;
    const decision = button.dataset.decision;

    setBusy(button, true, decision === "approved" ? "Approving…" : "Rejecting…");
    try {
      await courseService.reviewCourse(courseId, decision);
      toast(`Course ${decision} successfully.`);
      await loadPending();
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(button, false);
    }
  });

  await loadPending();
}
