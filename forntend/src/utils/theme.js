/**
 * VertexLearn AI - Theme Management (Dark & Light Mode)
 * Exclusively for Student and Instructor Workspaces.
 * Default: Dark Mode.
 */

const THEME_KEY = "vertex_theme";
const ALLOWED_ROLES = ["student", "instructor"];

export const SUN_ICON_SVG = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
`;

export const MOON_ICON_SVG = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
`;

/**
 * Check if the provided role is eligible for dark/light theme switching.
 */
export function isThemeAllowed(role) {
  if (!role) return false;
  return ALLOWED_ROLES.includes(String(role).toLowerCase());
}

/**
 * Get current persisted theme, defaults to "dark".
 */
export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    return "dark";
  }
}

/**
 * Set theme explicitly ("light" or "dark").
 * Only applied if role is student or instructor.
 */
export function setTheme(theme, role) {
  const normRole = String(role || "").toLowerCase();
  if (!isThemeAllowed(normRole)) {
    document.documentElement.removeAttribute("data-theme");
    return "dark";
  }

  const newTheme = theme === "light" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch { /* ignore */ }

  if (newTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  updateAllThemeButtons();
  return newTheme;
}

/**
 * Toggle between "dark" and "light" mode.
 */
export function toggleTheme(role) {
  const current = getTheme();
  const next = current === "light" ? "dark" : "light";
  return setTheme(next, role);
}

/**
 * Initialize theme based on role.
 * If user is not student or instructor, forces dark mode.
 */
export function initTheme(role) {
  const normRole = String(role || "").toLowerCase();
  if (!isThemeAllowed(normRole)) {
    document.documentElement.removeAttribute("data-theme");
    return "dark";
  }

  const saved = getTheme();
  if (saved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  updateAllThemeButtons();
  return saved;
}

/**
 * Update all theme toggle buttons on the page (icon, label, tooltip).
 */
export function updateAllThemeButtons() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const buttons = document.querySelectorAll("#theme-toggle-btn");
  buttons.forEach(btn => {
    const iconSpan = btn.querySelector("#theme-toggle-icon") || btn;
    if (isLight) {
      btn.title = "Switch to Dark mode";
      btn.setAttribute("aria-label", "Switch to Dark mode");
      iconSpan.innerHTML = MOON_ICON_SVG;
    } else {
      btn.title = "Switch to Light mode";
      btn.setAttribute("aria-label", "Switch to Light mode");
      iconSpan.innerHTML = SUN_ICON_SVG;
    }
  });
}

