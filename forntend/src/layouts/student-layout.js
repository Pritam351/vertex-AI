import { renderSidebar } from "../components/common/sidebar.js";
import { renderNavbar, bindNavbarEvents } from "../components/common/navbar.js";

export function renderStudentLayout(user, activeSection = "dashboard") {
  const sidebarHtml = renderSidebar({
    label: "STUDENT PORTAL",
    items: [
      { id: "dashboard", href: "#/student/dashboard", label: "My Learning", icon: "◈", isActive: activeSection === "dashboard" },
      { id: "catalog", href: "#/student/catalog", label: "Explore Courses", icon: "▣", isActive: activeSection === "catalog" },
      { id: "quizzes", href: "#/student/quizzes", label: "My Quizzes", icon: "◇", isActive: activeSection === "quizzes" },
      { id: "discussions", href: "#/student/discussions", label: "Discussions", icon: "💬", isActive: activeSection === "discussions" },
      { id: "certificates", href: "#/student/certificates", label: "Certificates", icon: "🎓", isActive: activeSection === "certificates" }
    ]
  });

  const sectionTitles = {
    dashboard: "My Learning Dashboard",
    catalog: "Course Catalog",
    player: "Course Player",
    quizzes: "Quizzes & Assessments",
    discussions: "Discussions & Q&A Forum",
    certificates: "My Certificates & Credentials"
  };

  const topbarHtml = renderNavbar({
    title: sectionTitles[activeSection] || "Student Portal",
    eyebrow: "STUDENT WORKSPACE",
    user
  });

  return `
    <section class="workspace" id="workspace">
      ${sidebarHtml}
      <div class="workspace-body">
        ${topbarHtml}
        <main id="main-content" class="content">
          <div id="student-page-container"></div>
        </main>
      </div>
    </section>
  `;
}

export function bindStudentLayoutEvents(container = document) {
  bindNavbarEvents(container);
}
