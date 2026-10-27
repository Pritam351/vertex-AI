import { renderSidebar } from "../components/common/sidebar.js";
import { renderNavbar, bindNavbarEvents } from "../components/common/navbar.js";

export function renderInstructorLayout(user, activeSection = "overview") {
  const sidebarHtml = renderSidebar({
    label: "INSTRUCTOR STUDIO",
    items: [
      { id: "overview", href: "#/instructor/overview", label: "Overview", icon: "◈", isActive: activeSection === "overview" },
      { id: "course-builder", href: "#/instructor/course-builder", label: "Course builder", icon: "▣", isActive: activeSection === "course-builder" },
      { id: "assessments", href: "#/instructor/assessments", label: "Assessments", icon: "◇", isActive: activeSection === "assessments" },
      { id: "analytics", href: "#/instructor/analytics", label: "Analytics", icon: "📊", isActive: activeSection === "analytics" }
    ]
  });

  const sectionTitles = {
    overview: "Overview",
    "course-builder": "Course builder",
    assessments: "Assessments",
    analytics: "Detailed Analytics"
  };

  const topbarHtml = renderNavbar({
    title: sectionTitles[activeSection] || "Overview",
    eyebrow: "INSTRUCTOR WORKSPACE",
    user
  });

  return `
    <section class="workspace" id="workspace">
      ${sidebarHtml}
      <div class="workspace-body">
        ${topbarHtml}
        <main id="main-content" class="content">
          <div id="instructor-page-container"></div>
        </main>
      </div>
    </section>
  `;
}

export function bindInstructorLayoutEvents(container = document) {
  bindNavbarEvents(container);
}
