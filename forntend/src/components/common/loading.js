export function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.innerHTML;
  }
  button.innerHTML = busy ? (label || "Saving…") : button.dataset.originalLabel;
}

export function createSpinner(size = "sm") {
  const spinner = document.createElement("span");
  spinner.className = `spinner spinner-${size}`;
  spinner.setAttribute("aria-hidden", "true");
  return spinner;
}
