export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

export function escapeHtml(value = "") {
  if (value === null || value === undefined) return "";
  const node = document.createElement("div");
  node.textContent = String(value);
  return node.innerHTML;
}

export function message(target, text = "", type = "") {
  if (!target) return;
  target.textContent = text;
  target.className = `form-message ${type}`.trim();
}
