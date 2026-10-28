import { getSession } from "../store/session.js";
import { checkRouteAccess } from "./route-guards.js";
import { DEFAULT_ROUTES } from "./route-config.js";

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

// Admin
import { mountAdminDashboard, mountAdminCourses, mountAdminUsers, showAdminView } from "../pages/admin-panel/admin.js";

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
  adminDashboard: new URL("../pages/admin-panel/dashboard.html", import.meta.url),
  adminCourses: new URL("../pages/admin-panel/courses.html", import.meta.url),
  adminUsers: new URL("../pages/admin-panel/users.html", import.meta.url)
};

async function fetchHtml(url) {
  const res = await fetch(url);
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
    const subSection = hash.split("/")[2] || "dashboard";

    if (currentRenderedLayout !== "student") {
      activeAppContainer.innerHTML = renderStudentLayout(user, subSection);
      bindStudentLayoutEvents(activeAppContainer);
      currentRenderedLayout = "student";
    }

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
    }
    return;
  }

  // 4. Admin Routing
  if (hash.startsWith("#/admin")) {
    document.title = "Admin Panel | VertexLearn AI";
    const subSection = hash.split("/")[2] || "dashboard";

    if (currentRenderedLayout !== "admin") {
      // First time loading admin layout — render full shell
      activeAppContainer.innerHTML = renderAdminLayout(user, subSection);
      bindAdminLayoutEvents(activeAppContainer);
      currentRenderedLayout = "admin";

      // Bind sidebar nav-link clicks to use hash navigation (prevent full page reload)
      activeAppContainer.querySelectorAll("#sidebar .nav-link").forEach((link) => {
        link.addEventListener("click", (e) => {
          // Let the hashchange event drive navigation — no action needed here
          // The hashchange listener on window already calls navigate()
        });
      });
    }

    const container = activeAppContainer.querySelector("#admin-page-container");
    if (!container) return;

    // Load the subsection content
    if (subSection === "dashboard") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminDashboard);
      showAdminView("dashboard");
      await mountAdminDashboard(container);
    } else if (subSection === "courses") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminCourses);
      showAdminView("courses");
      await mountAdminCourses(container);
    } else if (subSection === "users") {
      container.innerHTML = await fetchHtml(TEMPLATES.adminUsers);
      showAdminView("users");
      await mountAdminUsers(container);
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
