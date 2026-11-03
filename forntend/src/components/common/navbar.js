import { initials } from "../../utils/formatters.js";
import { authService } from "../../services/authService.js";
import { notificationService } from "../../services/notificationService.js";
import { gamificationService } from "../../services/gamificationService.js";
import { toast } from "./toast.js";
import { getSession } from "../../store/session.js";
import { getTheme, toggleTheme, initTheme, updateAllThemeButtons, SUN_ICON_SVG, MOON_ICON_SVG } from "../../utils/theme.js";

// ─── Notification type → emoji icon map ───────────────────────────────────────
const NOTIF_ICONS = {
  announcement: "📢",
  assignment: "📝",
  grade: "🏆",
  quiz: "🎯",
  certificate: "🎓",
  discussion: "💬",
  system: "⚙️",
  enrollment: "📚",
};

// ─── Relative time helper ──────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Render the topbar HTML ────────────────────────────────────────────────────
export function renderNavbar({ title = "Workspace", eyebrow = "STUDIO", user = null }) {
  const userInitials = initials(user?.fullName || "User");
  const userName = user?.fullName || "User";
  const userRole = (user?.role || "Member").toUpperCase();
  const rawRole = (user?.role || "").toLowerCase();
  const isEligibleForTheme = rawRole === "student" || rawRole === "instructor";
  const currentTheme = getTheme();
  const isLight = currentTheme === "light";

  return `
    <header class="topbar">
      <button class="icon-button mobile-menu" id="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <div class="page-context">
        <p class="eyebrow">${eyebrow}</p>
        <h1 id="page-title">${title}</h1>
      </div>
      <div class="account-menu">
        
        <!-- Streak counter (students) -->
        <a class="user-streak-pill" id="user-streak-pill" href="#/student/dashboard" hidden title="Daily active study streak">
          🔥 <span id="user-streak-days">0</span>d
        </a>

        ${isEligibleForTheme ? `
        <!-- Theme toggle (Dark & Light mode for Student & Instructor) -->
        <button
          class="theme-toggle-btn"
          id="theme-toggle-btn"
          type="button"
          aria-label="${isLight ? "Switch to Dark mode" : "Switch to Light mode"}"
          title="${isLight ? "Switch to Dark mode" : "Switch to Light mode"}"
        >
          <span class="theme-toggle-icon" id="theme-toggle-icon" aria-hidden="true">
            ${isLight ? MOON_ICON_SVG : SUN_ICON_SVG}
          </span>
        </button>
        ` : ""}

        <!-- Notification bell -->
        <div class="notif-bell-wrapper" id="notif-bell-wrapper">
          <button
            class="notif-bell-btn"
            id="notif-bell-btn"
            type="button"
            aria-label="Notifications"
            aria-expanded="false"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="notif-badge" id="notif-badge" hidden>0</span>
          </button>

          <div class="notif-dropdown" id="notif-dropdown" hidden aria-label="Notifications panel">
            <div class="notif-dropdown-header">
              <span>Notifications</span>
              <button type="button" class="notif-mark-all" id="notif-mark-all-read">Mark all read</button>
            </div>
            <div class="notif-dropdown-list" id="notif-dropdown-list">
              <p class="notif-empty-msg">Loading…</p>
            </div>
          </div>
        </div>
           <span class="avatar" id="user-initials" aria-hidden="true">${userInitials}</span>
        <div>
          <strong id="user-name">${userName}</strong>
          <small id="user-role">${userRole}</small>
        </div>
        <button class="text-button" id="sign-out" type="button">Sign out</button>
      </div>
    </header>
  `;
}

// ─── Render one notification row ──────────────────────────────────────────────
function renderNotifItem(notif) {
  const icon = NOTIF_ICONS[notif.type] || "🔔";
  const ago = timeAgo(notif.createdAt);
  const unread = !notif.isRead;

  return `
    <div class="notif-item${unread ? " is-unread" : ""}"
         data-notif-id="${notif._id}"
         data-notif-link="${notif.link || ""}">
      <span class="notif-item-icon" aria-hidden="true">${icon}</span>
      <div class="notif-item-body">
        <p class="notif-item-title">${notif.title || "Notification"}</p>
        <p class="notif-item-msg">${notif.message || ""}</p>
        <p class="notif-item-time">${ago}</p>
      </div>
      ${unread ? `<span class="notif-unread-dot" aria-hidden="true"></span>` : ""}
    </div>`;
}

// ─── Bind all navbar events (call after renderNavbar HTML is injected) ─────────
export function bindNavbarEvents(container = document) {

  // Sign-out
  // Theme toggle logic (Student & Instructor only)
  const themeBtn = container.querySelector("#theme-toggle-btn");
  if (themeBtn) {
    const session = getSession();
    const role = session?.user?.role?.toLowerCase();
    themeBtn.addEventListener("click", () => {
      toggleTheme(role);
      updateAllThemeButtons();
    });
  }

  // Sign-out
  container.querySelector("#sign-out")?.addEventListener("click", () => {
    initTheme(null); // Reset theme on sign-out
    toast("Signed out successfully.");
    authService.logout();
    window.location.hash = "#/login";
  });

  // Mobile sidebar toggle
  container.querySelector("#menu-toggle")?.addEventListener("click", () => {
    const sidebar = document.querySelector("#sidebar");
    const isOpen = sidebar?.classList.toggle("is-open");
    document.querySelector("#menu-toggle")?.setAttribute("aria-expanded", String(isOpen));
  });

  // ── Notification bell logic ──────────────────────────────────────────────────
  const bellBtn = container.querySelector("#notif-bell-btn");
  const dropdown = container.querySelector("#notif-dropdown");
  const badge = container.querySelector("#notif-badge");
  const listEl = container.querySelector("#notif-dropdown-list");
  const markAllBtn = container.querySelector("#notif-mark-all-read");

  if (!bellBtn || !dropdown) return;

  let notifications = [];

  // Update badge count
  function updateBadge(count) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  // Render notification list
  function renderList() {
    if (!notifications.length) {
      listEl.innerHTML = `<p class="notif-empty-msg">You're all caught up! 🎉</p>`;
      return;
    }
    listEl.innerHTML = notifications.map(renderNotifItem).join("");
  }

  // Fetch from API
  async function fetchNotifications() {
    try {
      const res = await notificationService.getMyNotifications({ limit: 15 });
      notifications = res?.data?.notifications || [];
      const unread = res?.data?.unreadCount ?? notifications.filter(n => !n.isRead).length;
      updateBadge(unread);
      renderList();
    } catch {
      // silently fail — don't break nav over notification errors
    }
  }

  // Toggle dropdown
  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.hidden;
    dropdown.hidden = !isOpen;
    bellBtn.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) fetchNotifications(); // refresh on open
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!dropdown.hidden && !container.querySelector("#notif-bell-wrapper")?.contains(e.target)) {
      dropdown.hidden = true;
      bellBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Mark all read
  markAllBtn?.addEventListener("click", async () => {
    try {
      await notificationService.markAllAsRead();
      notifications = notifications.map(n => ({ ...n, isRead: true }));
      updateBadge(0);
      renderList();
      toast("All notifications marked as read.");
    } catch {
      toast("Could not mark notifications as read.", "error");
    }
  });

  // Click individual notification
  listEl.addEventListener("click", async (e) => {
    const item = e.target.closest(".notif-item");
    if (!item) return;

    const notifId = item.dataset.notifId;
    const link = item.dataset.notifLink;

    // Mark as read locally
    const notif = notifications.find(n => n._id === notifId);
    if (notif && !notif.isRead) {
      notif.isRead = true;
      const newCount = notifications.filter(n => !n.isRead).length;
      updateBadge(newCount);
      renderList();
      // fire-and-forget API call
      notificationService.markAsRead(notifId).catch(() => { });
    }

    // Navigate if there's a link
    if (link) {
      dropdown.hidden = true;
      bellBtn.setAttribute("aria-expanded", "false");
      window.location.hash = link;
    }
  });

  // Initial fetch
  fetchNotifications();

  // Load study streak for students
  const streakPill = container.querySelector("#user-streak-pill");
  const streakDays = container.querySelector("#user-streak-days");
  if (streakPill && streakDays) {
    gamificationService.getMyStreak()
      .then((res) => {
        const streak = res?.data || res;
        const count = Number(streak?.currentStreak || 0);
        if (count > 0) {
          streakDays.textContent = count;
          streakPill.hidden = false;
        }
      })
      .catch(() => {});
  }
}
