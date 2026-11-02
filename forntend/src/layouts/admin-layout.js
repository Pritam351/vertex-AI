import { renderSidebar } from "../components/common/sidebar.js";
import { renderNavbar, bindNavbarEvents } from "../components/common/navbar.js";

export function renderAdminLayout(user, activeSection = "dashboard") {
  const sidebarHtml = renderSidebar({
    label: "ADMIN CONTROL",
    items: [
      { id: "dashboard", href: "#/admin/dashboard", label: "Dashboard", icon: "◈", isActive: activeSection === "dashboard" },
      { id: "courses", href: "#/admin/courses", label: "Pending Approvals", icon: "▣", isActive: activeSection === "courses" },
      { id: "users", href: "#/admin/users", label: "User Directory", icon: "◇", isActive: activeSection === "users" },
      { id: "moderation", href: "#/admin/moderation", label: "Forum Moderation", icon: "💬", isActive: activeSection === "moderation" }
    ]
  });

  const sectionTitles = {
    dashboard: "Admin Control Center",
    courses: "Course Approvals",
    users: "User Directory",
    moderation: "Forum Content Moderation"
  };

  const topbarHtml = renderNavbar({
    title: sectionTitles[activeSection] || "Admin Control",
    eyebrow: "ADMINISTRATION",
    user
  });

  return `
    <section class="workspace" id="workspace">
      ${sidebarHtml}
      <div class="workspace-body">
        ${topbarHtml}
        <main id="main-content" class="content">
          <div id="admin-page-container"></div>
        </main>
      </div>
    </section>
  `;
}

export function bindAdminLayoutEvents(container = document) {
  bindNavbarEvents(container);

  // Intercept sidebar link clicks: prevent default browser navigation,
  // update active state immediately so the click feels snappy.
  container.querySelectorAll("#sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      container.querySelectorAll("#sidebar .nav-link").forEach((l) => l.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
}

