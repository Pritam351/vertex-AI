import { renderSidebar } from "../components/common/sidebar.js";
import { renderNavbar, bindNavbarEvents } from "../components/common/navbar.js";

export function renderAdminLayout(user, activeSection = "dashboard") {
  const sidebarHtml = renderSidebar({
    label: "ADMIN CONTROL",
    items: [
      { id: "dashboard", href: "#/admin/dashboard", label: "Dashboard", icon: "◈", isActive: activeSection === "dashboard" },
      { id: "courses", href: "#/admin/courses", label: "Pending Approvals", icon: "▣", isActive: activeSection === "courses" },
      { id: "users", href: "#/admin/users", label: "User Directory", icon: "◇", isActive: activeSection === "users" }
    ]
  });

  const sectionTitles = {
    dashboard: "Admin Control Center",
    courses: "Course Approvals",
    users: "User Directory"
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
}
