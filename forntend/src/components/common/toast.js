// Alias so both `toast` and `showToast` imports work across the codebase
export const showToast = (text, kind = "success", duration = 4500) =>
  toast(text, kind, duration);

export function toast(text, kind = "success", duration = 4500) {
  let region = document.querySelector("#toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "toast-region";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
  }

  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.textContent = text;
  region.appendChild(item);

  window.setTimeout(() => {
    item.classList.add("toast-fade-out");
    setTimeout(() => item.remove(), 300);
  }, duration);
}
