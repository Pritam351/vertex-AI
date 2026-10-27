import { escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";

export function renderQuizItem(quiz) {
  const qCount = quiz.questions?.length || 0;
  const countLabel = qCount === 1 ? "question" : "questions";
  return `
    <div class="created-item" style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem;">
      <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
        <span class="status ${quiz.isPublished ? "published" : "pending"}">${quiz.isPublished ? "Published" : "Draft"}</span>
        <div style="min-width:0;">
          <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(quiz.title)}</strong>
          <small style="color:var(--muted);">${qCount} ${countLabel} • Pass: ${quiz.passingScore ?? 50}% • Time: ${quiz.timeLimitMinutes ?? 30}m</small>
        </div>
      </div>
      <div style="display:flex; gap:0.4rem; align-items:center; flex-shrink:0;">
        <button class="mini-button button-subtle" type="button" data-edit-quiz="${quiz._id}" title="Edit quiz questions and settings">✏️ Edit</button>
        ${quiz.isPublished ? "" : `<button class="mini-button button-primary" type="button" data-publish="${quiz._id}">🚀 Publish</button>`}
      </div>
    </div>
  `;
}

export function renderAssignmentItem(assignment) {
  return `
    <div class="created-item">
      <span>Due ${formatDate(assignment.dueDate)}</span>
      <strong>${escapeHtml(assignment.title)}</strong>
    </div>
  `;
}
