import { initials } from "../../utils/formatters.js";
import { authService } from "../../services/authService.js";

export function renderNavbar({ title = "Workspace", eyebrow = "STUDIO", user = null }) {
  const userInitials = initials(user?.fullName || "User");
  const userName = user?.fullName || "User";
  const userRole = (user?.role || "Member").toUpperCase();

  return `
    <header class="topbar">
      <button class="icon-button mobile-menu" id="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <div class="page-context">
        <p class="eyebrow">${eyebrow}</p>
        <h1 id="page-title">${title}</h1>
      </div>
      <div class="account-menu">
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

export function bindNavbarEvents(container = document) {
  container.querySelector("#sign-out")?.addEventListener("click", () => {
    authService.logout();
    window.location.hash = "#/login";
  });

  container.querySelector("#menu-toggle")?.addEventListener("click", () => {
    const sidebar = document.querySelector("#sidebar");
    const isOpen = sidebar?.classList.toggle("is-open");
    document.querySelector("#menu-toggle")?.setAttribute("aria-expanded", String(isOpen));
  });
}
