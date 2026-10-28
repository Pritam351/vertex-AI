import { courseService } from "../../services/courseService.js";
import { adminService } from "../../services/adminService.js";
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
  const statPending = $("#admin-stat-pending", container);
  try {
    const payload = await courseService.getPendingCourses();
    const count = payload?.data?.courses?.length || 0;
    if (statPending) statPending.textContent = count;
  } catch (error) {
    console.error("Could not load admin stats:", error);
  }
}

// ─── Pending Course Approvals ─────────────────────────────────────────────────
export async function mountAdminCourses(container) {
  const listContainer = $("#pending-list-container", container);
  const countEl = $("#pending-count", container);
  const loadingEl = $("#pending-loading", container);
  const emptyEl = $("#pending-empty", container);
  const errorEl = $("#pending-error", container);
  const errorMsgEl = $("#pending-error-message", container);
  const retryBtn = $("#pending-retry-btn", container);
  const refreshBtn = $("#pending-refresh-btn", container);

  function showState(state) {
    if (loadingEl) loadingEl.hidden = state !== "loading";
    if (emptyEl) emptyEl.hidden = state !== "empty";
    if (errorEl) errorEl.hidden = state !== "error";
    if (listContainer) listContainer.hidden = state !== "list";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderCourseCard(c) {
    const instructor = c.instructorId;
    const instructorName = instructor?.fullName || "Unknown Instructor";
    const instructorEmail = instructor?.email || "";
    const submitted = formatDate(c.createdAt);

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
            ${c.difficulty ? `<span class="course-badge course-badge-difficulty">${escapeHtml(c.difficulty)}</span>` : ""}
            <span class="status pending">Pending Approval</span>
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
            <span class="course-submitted-date">Submitted: <strong>${submitted}</strong></span>
          </div>
        </div>
        <div class="course-actions">
          <button class="button button-primary mini-button" type="button" data-review-id="${c._id}" data-decision="approved">
            ✓ Approve
          </button>
          <button class="button mini-button btn-reject" type="button" data-review-id="${c._id}" data-decision="rejected">
            ✕ Reject
          </button>
        </div>
      </article>
    `;
  }

  async function loadPending() {
    showState("loading");

    try {
      const payload = await courseService.getPendingCourses();
      const courses = payload?.data?.courses || [];

      if (countEl) countEl.textContent = `${courses.length} pending`;

      if (!courses.length) {
        showState("empty");
        return;
      }

      if (listContainer) {
        listContainer.innerHTML = courses.map(renderCourseCard).join("");
      }
      showState("list");
    } catch (error) {
      if (errorMsgEl) errorMsgEl.textContent = errorText(error);
      showState("error");
    }
  }

  // ── Action handler (approve / reject) ───────────────────────────────────────

  listContainer?.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-review-id]");
    if (!button) return;

    const courseId = button.dataset.reviewId;
    const decision = button.dataset.decision;
    const isApprove = decision === "approved";

    const article = button.closest("article");
    const title = article?.querySelector("h3")?.textContent || "this course";

    openModal({
      title: isApprove ? "Approve Course" : "Reject Course",
      contentHtml: `
        <p>Are you sure you want to <strong>${isApprove ? "approve" : "reject"}</strong> the course:</p>
        <p class="modal-course-title">"${escapeHtml(title)}"</p>
        ${!isApprove ? `<p class="modal-warning">The instructor will not be notified with a reason. Rejected courses can be resubmitted.</p>` : ""}
      `,
      confirmText: isApprove ? "✓ Approve" : "✕ Reject",
      onConfirm: async (_backdrop, close) => {
        const confirmBtn = _backdrop.querySelector(".modal-confirm");
        if (confirmBtn) confirmBtn.disabled = true;
        try {
          await courseService.reviewCourse(courseId, decision);
          close();
          toast(`Course ${decision} successfully.`, "success");
          await loadPending();
        } catch (error) {
          toast(errorText(error), "error");
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
    });
  });

  // ── Retry & Refresh ─────────────────────────────────────────────────────────
  retryBtn?.addEventListener("click", loadPending);
  refreshBtn?.addEventListener("click", async () => {
    setBusy(refreshBtn, true, "↻ Refreshing…");
    await loadPending();
    setBusy(refreshBtn, false);
  });

  await loadPending();
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
