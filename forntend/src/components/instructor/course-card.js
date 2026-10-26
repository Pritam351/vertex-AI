import { escapeHtml } from "../../utils/dom.js";

export function getCourseStatusLabel(course) {
  const status = String(course?.status || "pending").toLowerCase();
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Submitted for approval";
}

export function getCourseStatusClass(course) {
  const status = String(course?.status || "pending").toLowerCase();
  if (status === "approved") return "published";
  if (status === "rejected") return "rejected";
  return "pending";
}

export function renderInstructorCourseCard(course, isSelected = false) {
  const statusClass = getCourseStatusClass(course);
  const priceDisplay = Number(course.price) > 0 ? `₹${course.price}` : "Free";

  return `
    <article class="course-card-item ${isSelected ? "is-active-card" : ""}">
      <div class="course-card-main">
        <div class="course-badges-row">
          <span class="course-badge">${escapeHtml(course.category || "General")}</span>
          <span class="status ${statusClass}">${escapeHtml(course.status || "pending")}</span>
          ${isSelected ? `<span class="active-pill">✓ Active in Studio</span>` : ""}
        </div>
        <h3>${escapeHtml(course.title)}</h3>
        <p>${escapeHtml(course.description || "No description added.")}</p>
        <code>ID: ${escapeHtml(course._id)}</code>
      </div>
      <div class="course-actions">
        <span class="course-price">${priceDisplay}</span>
        <button class="button ${isSelected ? "button-primary" : "button-secondary"} mini-button" type="button" data-switch-course="${escapeHtml(course._id)}">
          ${isSelected ? "Manage Course →" : "Select & Edit →"}
        </button>
      </div>
    </article>
  `;
}
