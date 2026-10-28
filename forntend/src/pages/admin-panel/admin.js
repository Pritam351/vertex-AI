import { courseService } from "../../services/courseService.js";
import { adminService } from "../../services/adminService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { errorText } from "../../utils/validation.js";

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

// ─── User Directory ───────────────────────────────────────────────────────────
export async function mountAdminUsers(container) {
  // Elements
  const searchInput = $("#users-search", container);
  const roleFilter = $("#users-role-filter", container);
  const statusFilter = $("#users-status-filter", container);
  const resultCount = $("#users-result-count", container);
  const loadingEl = $("#users-loading", container);
  const emptyEl = $("#users-empty", container);
  const tableWrap = $("#users-table-wrap", container);
  const tbody = $("#users-tbody", container);
  const paginationEl = $("#users-pagination", container);
  const prevBtn = $("#users-prev-btn", container);
  const nextBtn = $("#users-next-btn", container);
  const pageInfo = $("#users-page-info", container);

  // Stat elements
  const statTotal = $("#stat-total", container);
  const statStudents = $("#stat-students", container);
  const statInstructors = $("#stat-instructors", container);
  const statAdmins = $("#stat-admins", container);
  const statActive = $("#stat-active", container);
  const statSuspended = $("#stat-suspended", container);

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

  function renderRow(user) {
    const statusClass = user.isActive ? "status-badge-active" : "status-badge-suspended";
    const statusText = user.isActive ? "Active" : "Suspended";
    const actionLabel = user.isActive ? "Suspend" : "Reactivate";
    const actionClass = user.isActive ? "btn-suspend" : "btn-reactivate";
    const avatarColor = user.isActive ? "var(--violet)" : "var(--muted)";

    return `
      <tr data-user-id="${escapeHtml(user._id)}" data-user-active="${user.isActive}">
        <td class="user-cell">
          <div class="user-avatar-wrap">
            <span class="user-avatar" style="background:${avatarColor};" aria-hidden="true">
              ${getInitials(user.fullName)}
            </span>
            <div class="user-info">
              <span class="user-name">${escapeHtml(user.fullName)}</span>
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
          <button
            class="button ${actionClass} mini-button"
            type="button"
            data-toggle-status="${escapeHtml(user._id)}"
            data-current-active="${user.isActive}"
            aria-label="${actionLabel} ${escapeHtml(user.fullName)}"
          >${actionLabel}</button>
        </td>
      </tr>
    `;
  }

  // ── Fetch & Render ──────────────────────────────────────────────────────────

  async function loadUsers() {
    // Show loading
    if (loadingEl) loadingEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (tableWrap) tableWrap.hidden = true;

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
        if (loadingEl) loadingEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        if (tableWrap) tableWrap.hidden = true;
        return;
      }

      // Render table
      if (tbody) tbody.innerHTML = users.map(renderRow).join("");
      if (loadingEl) loadingEl.hidden = true;
      if (tableWrap) tableWrap.hidden = false;

      // Pagination
      if (paginationEl) {
        paginationEl.hidden = totalPages <= 1;
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
      }
    } catch (error) {
      if (loadingEl) loadingEl.hidden = true;
      toast(`Failed to load users: ${errorText(error)}`, "error");
    }
  }

  // ── Toggle Status Handler ──────────────────────────────────────────────────

  tableWrap?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-toggle-status]");
    if (!btn) return;

    const userId = btn.dataset.toggleStatus;
    const currentActive = btn.dataset.currentActive === "true";
    const newActive = !currentActive;

    const confirmMsg = newActive
      ? "Are you sure you want to reactivate this user?"
      : "Are you sure you want to suspend this user? They will lose access to the platform.";

    if (!confirm(confirmMsg)) return;

    setBusy(btn, true, newActive ? "Reactivating…" : "Suspending…");
    try {
      const result = await adminService.updateUserStatus(userId, newActive);
      toast(result?.message || `User ${newActive ? "reactivated" : "suspended"} successfully.`);
      // Refresh current page to reflect new status
      await loadUsers();
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(btn, false);
    }
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
