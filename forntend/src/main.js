import { initRouter } from "./routes/router.js";
import { getSession } from "./store/session.js";

function bootstrap() {
  const appContainer = document.querySelector("#app");
  if (!appContainer) {
    console.error("VertexLearn AI: Application root container #app was not found.");
    return;
  }

  // Restore initial hash if empty
  if (!window.location.hash || window.location.hash === "#" || window.location.hash === "#/") {
    const session = getSession();
    const role = session?.user?.role?.toLowerCase();
    if (role === "instructor") {
      window.location.hash = "#/instructor/overview";
    } else if (role === "admin") {
      window.location.hash = "#/admin/dashboard";
    } else if (role === "student") {
      window.location.hash = "#/student/dashboard";
    } else {
      window.location.hash = "#/login";
    }
  }

  initRouter(appContainer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
