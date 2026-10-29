export function openModal({ title, contentHtml, onConfirm, confirmText = "Confirm" }) {
  const existing = document.querySelector("#app-modal");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "app-modal";
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 id="modal-title">${title}</h3>
        <button type="button" class="icon-button modal-close" aria-label="Close modal">✕</button>
      </div>
      <div class="modal-body">
        ${contentHtml}
      </div>
      <div class="modal-footer">
        <button type="button" class="button button-secondary modal-cancel">Cancel</button>
        ${onConfirm ? `<button type="button" class="button button-primary modal-confirm">${confirmText}</button>` : ""}
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.classList.add("modal-closing");
    setTimeout(() => backdrop.remove(), 200);
  };

  backdrop.querySelector(".modal-close")?.addEventListener("click", close);
  backdrop.querySelector(".modal-cancel")?.addEventListener("click", close);
  backdrop.querySelector(".modal-confirm")?.addEventListener("click", async (e) => {
    if (onConfirm) {
      await onConfirm(backdrop, close);
    }
  });

  // Close on backdrop click (outside dialog)
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  // Close on Escape key
  const onKeyDown = (e) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKeyDown); }
  };
  document.addEventListener("keydown", onKeyDown);

  return { close, element: backdrop };
}
