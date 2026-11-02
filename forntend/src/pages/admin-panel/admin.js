import { courseService } from "../../services/courseService.js";
import { adminService } from "../../services/adminService.js";
import { discussionService } from "../../services/discussionService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { openModal } from "../../components/common/modal.js";
import { errorText } from "../../utils/validation.js";
import { getUser } from "../../store/session.js";

// ─── Shared helper: show a specific content view inside the admin container ──
export function showAdminView(sectionId) {
  const container = document.querySelector("#admin-page-container");
  if (!container) return;

  // Toggle views
  container.querySelectorAll(".view").forEach((el) => {
    el.hidden = true;
    el.classList.remove("is-active");
  });
  const target = container.querySelector(`#admin-${sectionId}`);
  if (target) {
    target.hidden = false;
    target.classList.add("is-active");
  }

  // Update sidebar active state
  document.querySelectorAll("#sidebar .nav-link").forEach((link) => {
    const linkSection = link.getAttribute("href")?.split("/")[2] || "";
    link.classList.toggle("is-active", linkSection === sectionId);
  });

  // Update page title
  const titles = {
    dashboard: "Admin Control Center",
    courses: "Course Approvals",
    users: "User Directory",
  };
  const pageTitle = document.querySelector("#page-title");
  if (pageTitle) pageTitle.textContent = titles[sectionId] || "Admin Panel";

  // Close mobile sidebar
  document.querySelector("#sidebar")?.classList.remove("is-open");
  document.querySelector("#menu-toggle")?.setAttribute("aria-expanded", "false");
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function mountAdminDashboard(container) {
  // ── Element refs ────────────────────────────────────────────────────────────
  const statLive        = $("#dash-stat-live", container);
  const statPending     = $("#admin-stat-pending", container);
  const statRejected    = $("#dash-stat-rejected", container);
  const statTotal       = $("#dash-stat-total-courses", container);
  const statUsers       = $("#dash-stat-users", container);
  const statStudents    = $("#dash-stat-students", container);
  const statInstructors = $("#dash-stat-instructors", container);
  const statAdmins      = $("#dash-stat-admins", container);

  const loadingEl   = $("#dash-live-loading", container);
  const emptyEl     = $("#dash-live-empty", container);
  const errorEl     = $("#dash-live-error", container);
  const errorMsgEl  = $("#dash-live-error-msg", container);
  const tableWrap   = $("#dash-live-table-wrap", container);
  const tbody       = $("#dash-live-tbody", container);
  const retryBtn    = $("#dash-retry-btn", container);

  function showState(state) {
    if (loadingEl)  loadingEl.hidden  = state !== "loading";
    if (emptyEl)    emptyEl.hidden    = state !== "empty";
    if (errorEl)    errorEl.hidden    = state !== "error";
    if (tableWrap)  tableWrap.hidden  = state !== "table";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function difficultyBadge(diff) {
    const map = {
      beginner:     "dash-diff-beginner",
      intermediate: "dash-diff-intermediate",
      advanced:     "dash-diff-advanced",
    };
    const cls = map[diff] || "";
    return diff
      ? `<span class="course-badge ${cls}">${escapeHtml(diff.charAt(0).toUpperCase() + diff.slice(1))}</span>`
      : "—";
  }

  async function loadStats() {
    showState("loading");
    try {
      const payload = await adminService.getDashboardStats();
      const { courses = {}, users = {} } = payload?.data || {};

      // ── Course stat cards ────────────────────────────────────────────────
      if (statLive)        statLive.textContent        = courses.live      ?? "—";
      if (statPending)     statPending.textContent     = courses.pending   ?? "—";
      if (statRejected)    statRejected.textContent    = courses.rejected  ?? "—";
      if (statTotal)       statTotal.textContent       = courses.total     ?? "—";

      // ── User stat cards ──────────────────────────────────────────────────
      if (statUsers)        statUsers.textContent        = users.total       ?? "—";
      if (statStudents)     statStudents.textContent     = users.students    ?? "—";
      if (statInstructors)  statInstructors.textContent  = users.instructors ?? "—";
      if (statAdmins)       statAdmins.textContent       = users.admins      ?? "—";

      // ── Live courses table ────────────────────────────────────────────────
      const list = courses.liveCoursesList || [];
      if (!list.length) {
        showState("empty");
        return;
      }

      if (tbody) {
        tbody.innerHTML = list.map((c) => {
          const instructorName  = c.instructorId?.fullName || "—";
          const instructorEmail = c.instructorId?.email    || "—";
          return `
            <tr>
              <td class="user-cell">
                <span class="user-name">${escapeHtml(c.title)}</span>
              </td>
              <td><span class="course-badge">${escapeHtml(c.category || "General")}</span></td>
              <td>
                <div class="user-avatar-wrap">
                  <span class="user-avatar" style="background:var(--violet);" aria-hidden="true">
                    ${escapeHtml((instructorName[0] || "?").toUpperCase())}
                  </span>
                  <span class="user-name">${escapeHtml(instructorName)}</span>
                </div>
              </td>
              <td class="date-cell">${escapeHtml(instructorEmail)}</td>
              <td>${difficultyBadge(c.difficulty)}</td>
              <td class="date-cell">${formatDate(c.updatedAt || c.createdAt)}</td>
            </tr>
          `;
        }).join("");
      }
      showState("table");
    } catch (error) {
      if (errorMsgEl) errorMsgEl.textContent = errorText(error);
      showState("error");
    }
  }

  retryBtn?.addEventListener("click", loadStats);
  await loadStats();
}

// ─── Pending Course Approvals + Published + Archived ─────────────────────────
export async function mountAdminCourses(container) {

  // ── Shared helpers ───────────────────────────────────────────────────────────

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  /** Build a course card HTML string.
   *  context: "pending" | "published" | "archived"
   */
  function renderCourseCard(c, context) {
    const instructor = c.instructorId;
    const instructorName  = instructor?.fullName || "Unknown Instructor";
    const instructorEmail = instructor?.email    || "";
    const dateLabel = context === "pending" ? "Submitted" : context === "published" ? "Published" : "Archived";
    const dateValue = formatDate(c.updatedAt || c.createdAt);

    let statusBadge = "";
    let actionBtn   = "";

    if (context === "pending") {
      statusBadge = `<span class="status pending">Pending Approval</span>`;
      // TWO buttons kept for pending (approve / reject — different outcomes)
      actionBtn = `
        <button class="button button-primary mini-button" type="button"
          data-review-id="${c._id}" data-decision="approved">✓ Approve</button>
        <button class="button mini-button btn-reject" type="button"
          data-review-id="${c._id}" data-decision="rejected">✕ Reject</button>
      `;
    } else if (context === "published") {
      statusBadge = `<span class="status-badge status-badge-active" style="font-size:0.72rem;">● Live</span>`;
      // SINGLE button: Unpublish
      actionBtn = `
        <button class="button mini-button btn-unpublish" type="button"
          data-toggle-publish="${c._id}" data-action="unpublish"
          title="Remove from public catalog">⊘ Unpublish</button>
      `;
    } else {
      statusBadge = `<span class="status-badge status-badge-archived" style="font-size:0.72rem;">◌ Archived</span>`;
      // SINGLE button: Publish
      actionBtn = `
        <button class="button mini-button btn-publish" type="button"
          data-toggle-publish="${c._id}" data-action="publish"
          title="Restore to public catalog">▶ Publish</button>
      `;
    }

    return `
      <article class="course-card-item">
        ${c.thumbnailUrl
          ? `<div class="course-card-thumb">
               <img src="${escapeHtml(c.thumbnailUrl)}" alt="${escapeHtml(c.title)}" loading="lazy"
                    onerror="this.onerror=null;this.parentElement.style.display='none';" />
             </div>`
          : ""}
        <div class="course-card-main">
          <div class="course-badges-row">
            <span class="course-badge">${escapeHtml(c.category || "General")}</span>
            ${c.difficulty ? `<span class="course-badge course-badge-difficulty">${escapeHtml(c.difficulty)}</span>` : ""}
            ${statusBadge}
          </div>
          <h3>${escapeHtml(c.title)}</h3>
          <p class="course-card-desc">${escapeHtml(c.description || "No description added.")}</p>
          <div class="course-card-meta">
            <div class="course-instructor-info">
              <span class="course-instructor-avatar" aria-hidden="true">${escapeHtml(instructorName.charAt(0).toUpperCase())}</span>
              <div>
                <span class="course-instructor-name">${escapeHtml(instructorName)}</span>
                ${instructorEmail ? `<span class="course-instructor-email">${escapeHtml(instructorEmail)}</span>` : ""}
              </div>
            </div>
            <span class="course-submitted-date">${dateLabel}: <strong>${dateValue}</strong></span>
          </div>
        </div>
        <div class="course-actions">${actionBtn}</div>
      </article>
    `;
  }

  // ── Generic section builder ──────────────────────────────────────────────────

  function makeSection({ listEl, loadingEl, emptyEl, errorEl, errorMsgEl, countEl }) {
    function show(state) {
      if (loadingEl) loadingEl.hidden = state !== "loading";
      if (emptyEl)   emptyEl.hidden   = state !== "empty";
      if (errorEl)   errorEl.hidden   = state !== "error";
      if (listEl)    listEl.hidden    = state !== "list";
    }
    return { show };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PENDING SECTION
  // ═══════════════════════════════════════════════════════════════════

  const pendingList       = $("#pending-list-container",  container);
  const pendingCount      = $("#pending-count",           container);
  const pendingLoading    = $("#pending-loading",         container);
  const pendingEmpty      = $("#pending-empty",           container);
  const pendingError      = $("#pending-error",           container);
  const pendingErrorMsg   = $("#pending-error-message",   container);
  const pendingRetry      = $("#pending-retry-btn",       container);
  const pendingRefresh    = $("#pending-refresh-btn",     container);
  const { show: showPending } = makeSection({
    listEl: pendingList, loadingEl: pendingLoading, emptyEl: pendingEmpty,
    errorEl: pendingError, errorMsgEl: pendingErrorMsg, countEl: pendingCount,
  });

  async function loadPending() {
    showPending("loading");
    try {
      const payload = await courseService.getPendingCourses();
      const courses = payload?.data?.courses || [];
      if (pendingCount) pendingCount.textContent = `${courses.length} pending`;
      if (!courses.length) { showPending("empty"); return; }
      if (pendingList) pendingList.innerHTML = courses.map((c) => renderCourseCard(c, "pending")).join("");
      showPending("list");
    } catch (err) {
      if (pendingErrorMsg) pendingErrorMsg.textContent = errorText(err);
      showPending("error");
    }
  }

  // Pending: approve / reject via confirm modal
  pendingList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-review-id]");
    if (!btn) return;
    const courseId = btn.dataset.reviewId;
    const decision = btn.dataset.decision;
    const isApprove = decision === "approved";
    const title = btn.closest("article")?.querySelector("h3")?.textContent || "this course";

    openModal({
      title: isApprove ? "Approve Course" : "Reject Course",
      contentHtml: `
        <p>Are you sure you want to <strong>${isApprove ? "approve" : "reject"}</strong> the course:</p>
        <p class="modal-course-title">"${escapeHtml(title)}"</p>
        ${!isApprove ? `<p class="modal-warning">Rejected courses can be resubmitted by the instructor.</p>` : ""}
      `,
      confirmText: isApprove ? "✓ Approve" : "✕ Reject",
      onConfirm: async (_bd, close) => {
        const confirmBtn = _bd.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          await courseService.reviewCourse(courseId, decision);
          close();
          toast(`Course ${decision} successfully.`, "success");
          await loadPending();
          // Refresh the published list too if approved
          if (isApprove) await loadPublished();
        } catch (err) {
          toast(errorText(err), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  pendingRetry?.addEventListener("click", loadPending);
  pendingRefresh?.addEventListener("click", async () => {
    setBusy(pendingRefresh, true, "↻ Refreshing…");
    await loadPending();
    setBusy(pendingRefresh, false);
  });

  // ═══════════════════════════════════════════════════════════════════
  // PUBLISHED SECTION
  // ═══════════════════════════════════════════════════════════════════

  const publishedList      = $("#published-list-container", container);
  const publishedCount     = $("#published-count",          container);
  const publishedLoading   = $("#published-loading",        container);
  const publishedEmpty     = $("#published-empty",          container);
  const publishedError     = $("#published-error",          container);
  const publishedErrorMsg  = $("#published-error-message",  container);
  const publishedRetry     = $("#published-retry-btn",      container);
  const publishedRefresh   = $("#published-refresh-btn",    container);
  const { show: showPublished } = makeSection({
    listEl: publishedList, loadingEl: publishedLoading, emptyEl: publishedEmpty,
    errorEl: publishedError, errorMsgEl: publishedErrorMsg, countEl: publishedCount,
  });

  async function loadPublished() {
    showPublished("loading");
    try {
      const payload = await adminService.getPublishedCourses();
      const courses = payload?.data?.courses || [];
      if (publishedCount) publishedCount.textContent = `${courses.length} live`;
      if (!courses.length) { showPublished("empty"); return; }
      if (publishedList) publishedList.innerHTML = courses.map((c) => renderCourseCard(c, "published")).join("");
      showPublished("list");
    } catch (err) {
      if (publishedErrorMsg) publishedErrorMsg.textContent = errorText(err);
      showPublished("error");
    }
  }

  // Published: single "Unpublish" button
  publishedList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-toggle-publish]");
    if (!btn) return;
    const courseId = btn.dataset.togglePublish;
    const title = btn.closest("article")?.querySelector("h3")?.textContent || "this course";

    openModal({
      title: "Unpublish Course",
      contentHtml: `
        <p>Are you sure you want to <strong>unpublish</strong> this course?</p>
        <p class="modal-course-title">"${escapeHtml(title)}"</p>
        <p class="modal-warning">It will be removed from the student catalog immediately and moved to the Archived section.</p>
      `,
      confirmText: "⊘ Unpublish",
      onConfirm: async (_bd, close) => {
        const confirmBtn = _bd.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          const result = await adminService.toggleCoursePublish(courseId, "unpublish");
          close();
          toast(result?.message || "Course unpublished successfully.", "success");
          await Promise.all([loadPublished(), loadArchived()]);
        } catch (err) {
          toast(errorText(err), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  publishedRetry?.addEventListener("click", loadPublished);
  publishedRefresh?.addEventListener("click", async () => {
    setBusy(publishedRefresh, true, "↻ Refreshing…");
    await loadPublished();
    setBusy(publishedRefresh, false);
  });

  // ═══════════════════════════════════════════════════════════════════
  // ARCHIVED SECTION
  // ═══════════════════════════════════════════════════════════════════

  const archivedList      = $("#archived-list-container", container);
  const archivedCount     = $("#archived-count",          container);
  const archivedLoading   = $("#archived-loading",        container);
  const archivedEmpty     = $("#archived-empty",          container);
  const archivedError     = $("#archived-error",          container);
  const archivedErrorMsg  = $("#archived-error-message",  container);
  const archivedRetry     = $("#archived-retry-btn",      container);
  const archivedRefresh   = $("#archived-refresh-btn",    container);
  const { show: showArchived } = makeSection({
    listEl: archivedList, loadingEl: archivedLoading, emptyEl: archivedEmpty,
    errorEl: archivedError, errorMsgEl: archivedErrorMsg, countEl: archivedCount,
  });

  async function loadArchived() {
    showArchived("loading");
    try {
      const payload = await adminService.getArchivedCourses();
      const courses = payload?.data?.courses || [];
      if (archivedCount) archivedCount.textContent = `${courses.length} archived`;
      if (!courses.length) { showArchived("empty"); return; }
      if (archivedList) archivedList.innerHTML = courses.map((c) => renderCourseCard(c, "archived")).join("");
      showArchived("list");
    } catch (err) {
      if (archivedErrorMsg) archivedErrorMsg.textContent = errorText(err);
      showArchived("error");
    }
  }

  // Archived: single "Publish" button
  archivedList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-toggle-publish]");
    if (!btn) return;
    const courseId = btn.dataset.togglePublish;
    const title = btn.closest("article")?.querySelector("h3")?.textContent || "this course";

    openModal({
      title: "Re-publish Course",
      contentHtml: `
        <p>Are you sure you want to <strong>publish</strong> this course back to the live catalog?</p>
        <p class="modal-course-title">"${escapeHtml(title)}"</p>
        <p style="font-size:0.85rem;color:var(--muted);">Students will be able to see and enroll in it immediately.</p>
      `,
      confirmText: "▶ Publish",
      onConfirm: async (_bd, close) => {
        const confirmBtn = _bd.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          const result = await adminService.toggleCoursePublish(courseId, "publish");
          close();
          toast(result?.message || "Course published successfully.", "success");
          await Promise.all([loadArchived(), loadPublished()]);
        } catch (err) {
          toast(errorText(err), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  archivedRetry?.addEventListener("click", loadArchived);
  archivedRefresh?.addEventListener("click", async () => {
    setBusy(archivedRefresh, true, "↻ Refreshing…");
    await loadArchived();
    setBusy(archivedRefresh, false);
  });

  // ── Load all three sections in parallel ──────────────────────────────────────
  await Promise.all([loadPending(), loadPublished(), loadArchived()]);
}


// ─── User Directory ───────────────────────────────────────────────────────────
export async function mountAdminUsers(container) {
  // Elements
  const searchInput = $("#users-search", container);
  const roleFilter = $("#users-role-filter", container);
  const statusFilter = $("#users-status-filter", container);
  const resultCount = $("#users-result-count", container);
  const loadingEl = $("#users-loading", container);
  const emptyEl = $("#users-empty", container);
  const errorEl = $("#users-error", container);
  const errorMsgEl = $("#users-error-message", container);
  const tableWrap = $("#users-table-wrap", container);
  const tbody = $("#users-tbody", container);
  const paginationEl = $("#users-pagination", container);
  const prevBtn = $("#users-prev-btn", container);
  const nextBtn = $("#users-next-btn", container);
  const pageInfo = $("#users-page-info", container);
  const retryBtn = $("#users-retry-btn", container);

  // Stat elements
  const statTotal = $("#stat-total", container);
  const statStudents = $("#stat-students", container);
  const statInstructors = $("#stat-instructors", container);
  const statAdmins = $("#stat-admins", container);
  const statActive = $("#stat-active", container);
  const statSuspended = $("#stat-suspended", container);

  // Current admin user ID – used to prevent self-role-change
  const currentUser = getUser();
  const currentUserId = currentUser?._id || currentUser?.id || "";

  let currentPage = 1;
  let totalPages = 1;
  let debounceTimer = null;

  // ── Render Helpers ──────────────────────────────────────────────────────────

  function roleLabel(role) {
    const map = { student: "Student", instructor: "Instructor", admin: "Admin" };
    return map[role] || role;
  }

  function roleBadgeClass(role) {
    const map = { student: "role-badge-student", instructor: "role-badge-instructor", admin: "role-badge-admin" };
    return map[role] || "";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function getInitials(name) {
    if (!name) return "?";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function getRoleToggleOptions(role) {
    if (role === "student") {
      return { label: "Make Instructor", newRole: "instructor", cssClass: "btn-promote" };
    }
    if (role === "instructor") {
      return { label: "Make Student", newRole: "student", cssClass: "btn-demote-role" };
    }
    return null; // admin – no role change button
  }

  function renderRow(user) {
    const isSelf = user._id === currentUserId;
    const statusClass = user.isActive ? "status-badge-active" : "status-badge-suspended";
    const statusText = user.isActive ? "Active" : "Suspended";
    const actionLabel = user.isActive ? "Suspend" : "Reactivate";
    const actionClass = user.isActive ? "btn-suspend" : "btn-reactivate";
    const avatarColor = user.isActive ? "var(--violet)" : "var(--muted)";

    const roleToggle = getRoleToggleOptions(user.role);
    const roleChangeBtn = roleToggle && !isSelf
      ? `<button
           class="button ${roleToggle.cssClass} mini-button"
           type="button"
           data-change-role="${escapeHtml(user._id)}"
           data-target-role="${roleToggle.newRole}"
           data-user-name="${escapeHtml(user.fullName)}"
           data-current-role="${escapeHtml(user.role)}"
           aria-label="${roleToggle.label} for ${escapeHtml(user.fullName)}"
         >${roleToggle.label}</button>`
      : (isSelf && user.role !== "admin"
          ? `<span class="self-badge" title="Cannot change your own role">You</span>`
          : "");

    return `
      <tr data-user-id="${escapeHtml(user._id)}" data-user-active="${user.isActive}" data-user-role="${escapeHtml(user.role)}">
        <td class="user-cell">
          <div class="user-avatar-wrap">
            <span class="user-avatar" style="background:${avatarColor};" aria-hidden="true">
              ${getInitials(user.fullName)}
            </span>
            <div class="user-info">
              <span class="user-name">${escapeHtml(user.fullName)}${isSelf ? ' <span class="self-badge">You</span>' : ""}</span>
              <span class="user-email">${escapeHtml(user.email)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="role-badge ${roleBadgeClass(user.role)}">${roleLabel(user.role)}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td class="date-cell">${formatDate(user.createdAt)}</td>
        <td class="actions-cell text-right">
          <div class="actions-btn-group">
            ${roleChangeBtn}
            <button
              class="button ${actionClass} mini-button"
              type="button"
              data-toggle-status="${escapeHtml(user._id)}"
              data-current-active="${user.isActive}"
              ${isSelf && user.isActive ? 'disabled title="Cannot suspend your own account"' : ""}
              aria-label="${actionLabel} ${escapeHtml(user.fullName)}"
            >${actionLabel}</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ── Show state helpers ──────────────────────────────────────────────────────

  function showUsersState(state) {
    if (loadingEl) loadingEl.hidden = state !== "loading";
    if (emptyEl) emptyEl.hidden = state !== "empty";
    if (errorEl) errorEl.hidden = state !== "error";
    if (tableWrap) tableWrap.hidden = state !== "table";
  }

  // ── Fetch & Render ──────────────────────────────────────────────────────────

  async function loadUsers() {
    showUsersState("loading");

    try {
      const params = {
        search: searchInput?.value.trim() || "",
        role: roleFilter?.value || "all",
        status: statusFilter?.value || "all",
        page: currentPage,
        limit: 20,
      };

      const payload = await adminService.getUsers(params);
      const { users = [], total = 0, totalPages: tp = 1, stats = {} } = payload?.data || {};

      totalPages = tp;

      // Update stats
      if (statTotal) statTotal.textContent = stats.total ?? "—";
      if (statStudents) statStudents.textContent = stats.students ?? "—";
      if (statInstructors) statInstructors.textContent = stats.instructors ?? "—";
      if (statAdmins) statAdmins.textContent = stats.admins ?? "—";
      if (statActive) statActive.textContent = stats.active ?? "—";
      if (statSuspended) statSuspended.textContent = stats.suspended ?? "—";

      // Update result count
      if (resultCount) resultCount.textContent = `${total} user${total !== 1 ? "s" : ""}`;

      if (!users.length) {
        showUsersState("empty");
        return;
      }

      // Render table
      if (tbody) tbody.innerHTML = users.map(renderRow).join("");
      showUsersState("table");

      // Pagination
      if (paginationEl) {
        paginationEl.hidden = totalPages <= 1;
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
      }
    } catch (error) {
      if (errorMsgEl) errorMsgEl.textContent = errorText(error);
      showUsersState("error");
    }
  }

  // ── Toggle Status Handler ──────────────────────────────────────────────────

  tableWrap?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-toggle-status]");
    if (!btn) return;

    const userId = btn.dataset.toggleStatus;
    const currentActive = btn.dataset.currentActive === "true";
    const newActive = !currentActive;
    const row = btn.closest("tr");
    const userName = row?.querySelector(".user-name")?.textContent?.trim() || "this user";

    openModal({
      title: newActive ? "Reactivate Account" : "Suspend Account",
      contentHtml: `
        <p>Are you sure you want to <strong>${newActive ? "reactivate" : "suspend"}</strong> the account for:</p>
        <p class="modal-course-title">${escapeHtml(userName)}</p>
        ${!newActive ? `<p class="modal-warning">This user will immediately lose access to the platform.</p>` : ""}
      `,
      confirmText: newActive ? "Reactivate" : "Suspend",
      onConfirm: async (_backdrop, close) => {
        const confirmBtn = _backdrop.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          const result = await adminService.updateUserStatus(userId, newActive);
          close();
          toast(result?.message || `User ${newActive ? "reactivated" : "suspended"} successfully.`, "success");
          await loadUsers();
        } catch (error) {
          toast(errorText(error), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  // ── Change Role Handler ────────────────────────────────────────────────────

  tableWrap?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-change-role]");
    if (!btn) return;

    const userId = btn.dataset.changeRole;
    const targetRole = btn.dataset.targetRole;
    const userName = btn.dataset.userName || "this user";
    const currentRole = btn.dataset.currentRole;

    const isPromote = targetRole === "instructor";
    const actionVerb = isPromote ? "promote to Instructor" : "change back to Student";

    openModal({
      title: isPromote ? "Promote to Instructor" : "Change Role to Student",
      contentHtml: `
        <p>Are you sure you want to <strong>${actionVerb}</strong>:</p>
        <p class="modal-course-title">${escapeHtml(userName)}</p>
        <p class="modal-meta-info">Current role: <span class="modal-role-badge modal-role-${escapeHtml(currentRole)}">${currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}</span> → <span class="modal-role-badge modal-role-${escapeHtml(targetRole)}">${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)}</span></p>
        ${isPromote ? `<p class="modal-warning">This user will gain instructor capabilities to create and manage courses.</p>` : `<p class="modal-warning">This user will lose instructor capabilities and course management access.</p>`}
      `,
      confirmText: isPromote ? "Promote" : "Change Role",
      onConfirm: async (_backdrop, close) => {
        const confirmBtn = _backdrop.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          const result = await adminService.updateUserRole(userId, targetRole);
          close();
          toast(result?.message || `Role updated to ${targetRole} successfully.`, "success");
          await loadUsers();
        } catch (error) {
          toast(errorText(error), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  // ── Retry handler ───────────────────────────────────────────────────────────

  retryBtn?.addEventListener("click", () => {
    currentPage = 1;
    loadUsers();
  });

  // ── Search & Filter Listeners ──────────────────────────────────────────────

  searchInput?.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentPage = 1;
      loadUsers();
    }, 350);
  });

  roleFilter?.addEventListener("change", () => {
    currentPage = 1;
    loadUsers();
  });

  statusFilter?.addEventListener("change", () => {
    currentPage = 1;
    loadUsers();
  });

  // ── Pagination ─────────────────────────────────────────────────────────────

  prevBtn?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  });

  nextBtn?.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  });

  // ── Initial Load ──────────────────────────────────────────────────────────
  await loadUsers();
}

// ─── Forum Moderation ───────────────────────────────────────────────────────
export async function mountAdminModeration(container) {
  const filterSelect = $("#moderation-filter-select", container);
  const refreshBtn = $("#btn-refresh-moderation", container);
  const countPill = $("#mod-queue-count", container);
  const loadingEl = $("#mod-queue-loading", container);
  const emptyEl = $("#mod-queue-empty", container);
  const queueContainer = $("#mod-queue-container", container);

  async function loadQueue() {
    if (loadingEl) loadingEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (queueContainer) queueContainer.innerHTML = "";

    const filter = filterSelect?.value || "flagged";
    try {
      const res = await discussionService.getModerationQueue(filter);
      const items = res?.data || [];
      if (countPill) countPill.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;

      if (!items.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }

      if (emptyEl) emptyEl.hidden = true;
      queueContainer.innerHTML = items.map((thread) => {
        const courseTitle = escapeHtml(thread.courseId?.title || "Course");
        const authorName = escapeHtml(thread.createdBy?.name || "User");
        const authorRole = escapeHtml(thread.createdBy?.role || "student");
        const title = escapeHtml(thread.title);
        const content = escapeHtml(thread.content).replace(/\n/g, "<br>");
        const dateStr = thread.createdAt ? new Date(thread.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) : "";

        // Collect flagged or hidden posts in this thread
        const flaggedPosts = (thread.posts || []).filter(p => p.isFlagged || p.isHidden);

        return `
          <div class="panel form-panel" style="background:#11192d; border:1px solid ${thread.isFlagged ? "rgba(245,158,11,0.4)" : "#27314b"}; border-radius:10px; padding:1.25rem;">
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.75rem;">
              <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <span style="font-size:0.75rem; color:#818cf8; font-weight:600;">📚 ${courseTitle}</span>
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <strong style="font-size:0.95rem; color:#f8fafc;">${title}</strong>
                  ${thread.isFlagged ? `<span class="status" style="background:rgba(245,158,11,0.18); color:#fbbf24; font-size:0.65rem; padding:0.15rem 0.45rem; font-weight:700;">🚩 FLAGGED THREAD</span>` : ""}
                  ${thread.isHidden ? `<span class="status" style="background:rgba(100,116,139,0.25); color:#94a3b8; font-size:0.65rem; padding:0.15rem 0.45rem; font-weight:700;">👁 HIDDEN</span>` : ""}
                  ${thread.isLocked ? `<span class="status" style="background:rgba(239,68,68,0.18); color:#fca5a5; font-size:0.65rem; padding:0.15rem 0.45rem; font-weight:700;">🔒 LOCKED</span>` : ""}
                </div>
              </div>
              <span style="font:500 0.68rem 'DM Mono', monospace; color:#9da4c2;">${dateStr}</span>
            </div>

            <!-- Thread Content -->
            <div style="margin-top:0.75rem;">
              <div style="font-size:0.75rem; color:#9da4c2; margin-bottom:0.35rem;">
                Created by <strong>${authorName}</strong> (${authorRole})
                ${thread.flagReason ? `<span style="color:#fbbf24; margin-left:0.5rem;">• Report reason: <em>${escapeHtml(thread.flagReason)}</em></span>` : ""}
              </div>
              <div style="font-size:0.84rem; line-height:1.6; color:#cbd5e1; background:rgba(0,0,0,0.15); padding:0.75rem; border-radius:6px;">
                ${content}
              </div>
            </div>

            <!-- Thread Moderation Actions -->
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.5rem; margin-top:0.75rem; padding-top:0.6rem; border-top:1px solid rgba(255,255,255,0.06);">
              ${thread.isFlagged ? `
                <button type="button" class="mini-button" data-mod-action="unflag" data-mod-target="thread" data-thread-id="${thread._id}" style="color:#34d399; border-color:rgba(52,211,153,0.4);">
                  ✓ Dismiss Report
                </button>
              ` : ""}
              <button type="button" class="mini-button" data-mod-action="${thread.isHidden ? "unhide" : "hide"}" data-mod-target="thread" data-thread-id="${thread._id}">
                ${thread.isHidden ? "👁 Restore (Unhide)" : "👁 Hide Thread"}
              </button>
              <button type="button" class="mini-button" data-mod-action="${thread.isLocked ? "unlock" : "lock"}" data-mod-target="thread" data-thread-id="${thread._id}">
                ${thread.isLocked ? "🔓 Unlock" : "🔒 Lock"}
              </button>
            </div>

            <!-- Flagged Replies in this Thread -->
            ${flaggedPosts.length > 0 ? `
              <div style="margin-top:1rem; border-top:1px dashed rgba(255,255,255,0.1); padding-top:0.75rem;">
                <h5 style="margin:0 0 0.5rem 0; font-size:0.8rem; color:#fca5a5;">Flagged Replies (${flaggedPosts.length})</h5>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${flaggedPosts.map(post => {
                    const pName = escapeHtml(post.userId?.name || "User");
                    const pRole = escapeHtml(post.userId?.role || "student");
                    const pContent = escapeHtml(post.content).replace(/\n/g, "<br>");
                    return `
                      <div style="background:#0b1022; border:1px solid #1e293b; border-radius:8px; padding:0.75rem; display:flex; flex-direction:column; gap:0.4rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                          <div style="font-size:0.75rem; color:#9da4c2;">
                            Reply by <strong>${pName}</strong> (${pRole})
                            ${post.isFlagged ? `<span style="color:#fbbf24; margin-left:0.4rem;">🚩 Flagged: <em>${escapeHtml(post.flagReason || "Reported")}</em></span>` : ""}
                            ${post.isHidden ? `<span style="color:#94a3b8; margin-left:0.4rem;">👁 Hidden</span>` : ""}
                          </div>
                          <div style="display:flex; gap:0.4rem;">
                            ${post.isFlagged ? `
                              <button type="button" class="mini-button" data-mod-action="unflag" data-mod-target="post" data-thread-id="${thread._id}" data-post-id="${post._id}" style="color:#34d399; font-size:0.7rem; padding:0.2rem 0.5rem;">
                                ✓ Dismiss
                              </button>
                            ` : ""}
                            <button type="button" class="mini-button" data-mod-action="${post.isHidden ? "unhide" : "hide"}" data-mod-target="post" data-thread-id="${thread._id}" data-post-id="${post._id}" style="font-size:0.7rem; padding:0.2rem 0.5rem;">
                              ${post.isHidden ? "Unhide" : "Hide"}
                            </button>
                          </div>
                        </div>
                        <div style="font-size:0.8rem; color:#cbd5e1; line-height:1.5;">
                          ${pContent}
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            ` : ""}
          </div>
        `;
      }).join("");
    } catch (err) {
      toast(`Failed to load moderation queue: ${errorText(err)}`, "error");
    } finally {
      if (loadingEl) loadingEl.hidden = true;
    }
  }

  // Filter change
  filterSelect?.addEventListener("change", loadQueue);
  refreshBtn?.addEventListener("click", loadQueue);

  // Moderation action delegation
  queueContainer?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-mod-action]");
    if (!btn) return;
    const action = btn.dataset.modAction;
    const target = btn.dataset.modTarget;
    const threadId = btn.dataset.threadId;
    const postId = btn.dataset.postId || null;

    btn.disabled = true;
    try {
      await discussionService.moderateDiscussion(threadId, {
        action,
        target,
        postId
      });
      toast(`Action applied: ${action} ${target}.`);
      await loadQueue();
    } catch (err) {
      toast(`Moderation failed: ${errorText(err)}`, "error");
    } finally {
      btn.disabled = false;
    }
  });

  await loadQueue();
}
