import { initRouter } from "./routes/router.js";
import { getSession } from "./store/session.js";
import { initTheme } from "./utils/theme.js";

function bootstrap() {
  const session = getSession();
  const role = session?.user?.role?.toLowerCase();
  initTheme(role);

  const appContainer = document.querySelector("#app");
  if (!appContainer) {
    console.error("VertexLearn AI: Application root container #app was not found.");
    return;
  }

  // Restore initial hash if empty - default to homepage for visitors
  if (!window.location.hash || window.location.hash === "#") {
    window.location.hash = "#/";
  }

  initRouter(appContainer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
