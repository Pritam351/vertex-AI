export function message(target, text = "", type = "") { target.textContent = text; target.className = `form-message ${type}`; }
export function setBusy(button, busy, label) { if (!button) return; button.disabled = busy; button.dataset.label ??= button.innerHTML; button.innerHTML = busy ? "Saving…" : (label || button.dataset.label); }
export function toast(text, kind = "success") { const region = document.querySelector("#toast-region"); const item = document.createElement("div"); item.className = `toast ${kind}`; item.textContent = text; region.append(item); window.setTimeout(() => item.remove(), 4500); }
export function initials(name = "") { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "IN"; }
export function errorText(error) { const detail = error?.errors?.[0]; return detail?.message ? `${error.message}: ${detail.message}` : error.message; }
