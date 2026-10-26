import { escapeHtml } from "../../utils/dom.js";

export function renderModuleItem(module) {
  return `
    <div class="created-item">
      <span>Module ${module.orderIndex || 1}</span>
      <strong>${escapeHtml(module.title)}</strong>
      <code>${escapeHtml(module._id)}</code>
    </div>
  `;
}

export function renderLectureItem(lecture) {
  const durationText = lecture.durationSeconds ? ` • ${Math.round(lecture.durationSeconds / 60)} min` : "";
  return `
    <div class="created-item">
      <span>Lecture ${lecture.orderIndex || 1}</span>
      <strong>${escapeHtml(lecture.title)}</strong>
      <small>${escapeHtml(lecture.moduleTitle || "Module")}${durationText}</small>
    </div>
  `;
}
