import { escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";

export function renderQuizItem(quiz) {
  const qCount = quiz.questions?.length || 0;
  const countLabel = qCount === 1 ? "question" : "questions";
  return `
    <div class="created-item">
      <span class="status ${quiz.isPublished ? "published" : "pending"}">${quiz.isPublished ? "Published" : "Draft"}</span>
      <strong>${escapeHtml(quiz.title)}</strong>
      <small style="color:var(--muted);">${qCount} ${countLabel} • Pass: ${quiz.passingScore ?? 50}%</small>
      ${quiz.isPublished ? "" : `<button class="mini-button" type="button" data-publish="${quiz._id}">Publish</button>`}
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
