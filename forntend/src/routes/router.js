import { getSession } from "../store/session.js";
import { checkRouteAccess } from "./route-guards.js";
import { DEFAULT_ROUTES } from "./route-config.js";
import { initTheme } from "../utils/theme.js";

// Layouts
import { renderAuthLayout } from "../layouts/auth-layout.js";
import { renderInstructorLayout, bindInstructorLayoutEvents } from "../layouts/instructor-layout.js";
import { renderStudentLayout, bindStudentLayoutEvents } from "../layouts/student-layout.js";
import { renderAdminLayout, bindAdminLayoutEvents } from "../layouts/admin-layout.js";

// Auth
import { bindAuthEvents } from "../pages/auth/auth.js";

// Instructor
import { mountInstructorWorkspace, loadInstructorFragments } from "../pages/instructor/instructor.js";

// Student
import { mountStudentDashboard } from "../pages/dashboard/dashboard.js";
import { mountCourseCatalog } from "../pages/course-catalog/catalog.js";
import { mountCoursePlayer } from "../pages/course-player/player.js";
import { mountStudentQuizzes } from "../pages/quizzes/quiz.js";
import { mountStudentCertificates } from "../pages/certificates/certificates.js";
import { mountStudentDiscussions } from "../pages/discussions/student-discussions.js";

// Admin
import { mountAdminDashboard, mountAdminCourses, mountAdminUsers, mountAdminModeration, showAdminView } from "../pages/admin-panel/admin.js";

// Export backward compatible loader
export { loadInstructorFragments as loadInstructorPages };

// Template URLs for dynamic fetching
const TEMPLATES = {
  login: new URL("../pages/auth/login.html", import.meta.url),
  register: new URL("../pages/auth/register.html", import.meta.url),
  studentDashboard: new URL("../pages/dashboard/student-dashboard.html", import.meta.url),
  studentCatalog: new URL("../pages/course-catalog/catalog.html", import.meta.url),
  studentPlayer: new URL("../pages/course-player/player.html", import.meta.url),
  studentQuizzes: new URL("../pages/quizzes/quiz.html", import.meta.url),
  studentDiscussions: new URL("../pages/discussions/student-discussions.html", import.meta.url),
  studentCertificates: new URL("../pages/certificates/certificates.html", import.meta.url),
  adminDashboard: new URL("../pages/admin-panel/dashboard.html", import.meta.url),
  adminCourses: new URL("../pages/admin-panel/courses.html", import.meta.url),
  adminUsers: new URL("../pages/admin-panel/users.html", import.meta.url),
  adminModeration: new URL("../pages/admin-panel/moderation.html", import.meta.url)
};

async function fetchHtml(url) {
  const u = new URL(url.toString());
  u.searchParams.set("_v", Date.now());
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load template from ${url.pathname}`);
  return res.text();
}

let activeAppContainer = null;
let currentRenderedLayout = null;

export async function navigate() {
  if (!activeAppContainer) return;

  const rawHash = window.location.hash || "";
  const guard = checkRouteAccess(rawHash);

  if (!guard.allowed && guard.redirect) {
    if (window.location.hash !== guard.redirect) {
      window.location.hash = guard.redirect;
      return;
    }
  }

  const hash = rawHash.split("?")[0].replace(/\/$/, "");
  const session = getSession();
  const user = session?.user || null;

  // 1. Auth Routing
  if (hash === "#/login" || hash === "#login" || hash === "#/register" || hash === "#register" || !user) {
    const isRegister = hash.includes("register");
    document.title = isRegister ? "Create Account | VertexLearn AI" : "Sign In | VertexLearn AI";

    const formHtml = await fetchHtml(isRegister ? TEMPLATES.register : TEMPLATES.login);
    activeAppContainer.innerHTML = renderAuthLayout(formHtml, isRegister);
    bindAuthEvents(activeAppContainer, isRegister);
    currentRenderedLayout = "auth";
    return;
  }

  // 2. Instructor Routing
  if (hash.startsWith("#/instructor")) {
    document.title = "Instructor Studio | VertexLearn AI";
    initTheme("instructor");
    const subSection = hash.split("/")[2] || "overview";

    if (currentRenderedLayout !== "instructor") {
      activeAppContainer.innerHTML = renderInstructorLayout(user, subSection);
      bindInstructorLayoutEvents(activeAppContainer);
      currentRenderedLayout = "instructor";
      const container = activeAppContainer.querySelector("#instructor-page-container");
      await mountInstructorWorkspace(container, subSection);
    } else {
      // Switch view without full reload
      const { showView } = await import("../pages/instructor/instructor.js");
      showView(subSection);
    }
    return;
  }

  // 3. Student Routing
  if (hash.startsWith("#/student")) {
    document.title = "Student Workspace | VertexLearn AI";
    initTheme("student");
    const subSection = hash.split("/")[2] || "dashboard";

    if (currentRenderedLayout !== "student") {
      activeAppContainer.innerHTML = renderStudentLayout(user, subSection);
      bindStudentLayoutEvents(activeAppContainer);
      currentRenderedLayout = "student";
    }

    // Update sidebar active state for current section
    activeAppContainer.querySelectorAll("#sidebar .nav-link").forEach((link) => {
      const linkSection = link.getAttribute("href")?.split("/")[2] || "";
      link.classList.toggle("is-active", linkSection === subSection);
    });

    // Update topbar title
    const studentSectionTitles = {
      dashboard: "My Learning Dashboard",
      catalog: "Course Catalog",
      player: "Course Player",
      quizzes: "Quizzes & Assessments",
      discussions: "Discussions & Q&A Forum",
      certificates: "My Certificates & Credentials"
    };
    const pageTitleEl = activeAppContainer.querySelector("#page-title");
    if (pageTitleEl) pageTitleEl.textContent = studentSectionTitles[subSection] || "Student Portal";

    const container = activeAppContainer.querySelector("#student-page-container");
    if (!container) return;

    if (subSection === "dashboard") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentDashboard);
      await mountStudentDashboard(container);
    } else if (subSection === "catalog") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentCatalog);
      await mountCourseCatalog(container);
    } else if (subSection === "player") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentPlayer);
      await mountCoursePlayer(container);
    } else if (subSection === "quizzes") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentQuizzes);
      await mountStudentQuizzes(container);
    } else if (subSection === "discussions") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentDiscussions);
      await mountStudentDiscussions(container);
    } else if (subSection === "certificates") {
      container.innerHTML = await fetchHtml(TEMPLATES.studentCertificates);
      await mountStudentCertificates(container);
    }
    return;
  }

  // 4. Admin Routing
  if (hash.startsWith("#/admin")) {
    document.title = "Admin Panel | VertexLearn AI";
    initTheme("admin");
    const subSection = hash.split("/")[2] || "dashboard";

    // Only rebuild the shell if we're switching from a different layout.
    // When already in admin, we reuse the existing sidebar/navbar and only
    // swap out the content pane — this is what was missing before.
    if (currentRenderedLayout !== "admin") {
      activeAppContainer.innerHTML = renderAdminLayout(user, subSection);
      bindAdminLayoutEvents(activeAppContainer);
      currentRenderedLayout = "admin";
    }

    const container = activeAppContainer.querySelector("#admin-page-container");
    if (!container) return;

    // Update sidebar active state for the current section
    activeAppContainer.querySelectorAll("#sidebar .nav-link").forEach((link) => {
      const linkSection = link.getAttribute("href")?.split("/")[2] || "";
      link.classList.toggle("is-active", linkSection === subSection);
    });

    // Update topbar title
    const sectionTitles = {
      dashboard: "Overview",
      courses: "Course Approvals",
      users: "User Directory",
      moderation: "Forum Content Moderation"
    };
    const pageTitleEl = activeAppContainer.querySelector("#page-title");
    if (pageTitleEl) pageTitleEl.textContent = sectionTitles[subSection] || "Admin Panel";

    // Always reload the content pane for every admin navigation
    if (subSection === "dashboard") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminDashboard);
      await mountAdminDashboard(container);
    } else if (subSection === "courses") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminCourses);
      await mountAdminCourses(container);
    } else if (subSection === "users") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminUsers);
      await mountAdminUsers(container);
    } else if (subSection === "moderation") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminModeration);
      await mountAdminModeration(container);
    }
    return;
  }

  // Fallback
  const role = user?.role?.toLowerCase() || "student";
  window.location.hash = DEFAULT_ROUTES[role] || DEFAULT_ROUTES.unauthenticated;
}

export function initRouter(container) {
  activeAppContainer = container;

  window.addEventListener("hashchange", () => {
    navigate();
  });

  window.addEventListener("vertex:session-expired", () => {
    currentRenderedLayout = null;
    window.location.hash = "#/login";
  });

  navigate();
}
