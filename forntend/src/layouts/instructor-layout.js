import { renderSidebar } from "../components/common/sidebar.js";
import { renderNavbar, bindNavbarEvents } from "../components/common/navbar.js";
import { getMegaphoneSvg } from "../components/common/icons.js";

export function renderInstructorLayout(user, activeSection = "overview") {
  const sidebarHtml = renderSidebar({
    label: "INSTRUCTOR STUDIO",
    items: [
      { id: "overview", href: "#/instructor/overview", label: "Overview", icon: "◈", isActive: activeSection === "overview" },
      { id: "course-builder", href: "#/instructor/course-builder", label: "Course builder", icon: "▣", isActive: activeSection === "course-builder" },
      { id: "assessments", href: "#/instructor/assessments", label: "Assessments", icon: "◇", isActive: activeSection === "assessments" },
      { id: "announcements", href: "#/instructor/announcements", label: "Announcements", icon: getMegaphoneSvg({ size: 16 }), isActive: activeSection === "announcements" },
      { id: "discussions", href: "#/instructor/discussions", label: "Discussions", icon: "💬", isActive: activeSection === "discussions" },
      { id: "analytics", href: "#/instructor/analytics", label: "Analytics", icon: "Δ", isActive: activeSection === "analytics" }
    ]
  });

  const sectionTitles = {
    overview: "Overview",
    "course-builder": "Course builder",
    assessments: "Assessments",
    announcements: "Course Announcements",
    discussions: "Course Discussions & Q&A",
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

  // Intercept sidebar link clicks — prevent anchor scroll, update active state
  // The hash change still fires and the router handles content switching via showView()
  container.querySelectorAll("#sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      container.querySelectorAll("#sidebar .nav-link").forEach((l) => l.classList.remove("is-active"));
      link.classList.add("is-active");
      // Close mobile sidebar on nav
      document.querySelector("#sidebar")?.classList.remove("is-open");
      document.querySelector("#menu-toggle")?.setAttribute("aria-expanded", "false");
    });
  });
}
