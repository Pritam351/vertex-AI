import { courseService } from "../../services/courseService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { formatCurrency } from "../../utils/formatters.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { errorText } from "../../utils/validation.js";

let enrolledCourseIds = new Set();

export async function mountCourseCatalog(container) {
  const listContainer = $("#catalog-list-container", container);
  const countEl = $("#catalog-count", container);
  const emptyEl = $("#catalog-empty", container);
  const filterForm = $("#catalog-filter-form", container);

  async function loadData(params = {}) {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.allSettled([
        courseService.listCourses(params),
        enrollmentService.getMyEnrollments()
      ]);

      enrolledCourseIds = new Set();
      if (enrollmentsRes.status === "fulfilled" && enrollmentsRes.value?.data?.enrollments) {
        enrollmentsRes.value.data.enrollments.forEach((e) => {
          const id = e.courseId?._id || e.courseId;
          if (id) enrolledCourseIds.add(id);
        });
      }

      const courses = coursesRes.status === "fulfilled" ? (coursesRes.value?.data?.courses || []) : [];
      if (countEl) countEl.textContent = courses.length === 1 ? "1 course" : `${courses.length} courses`;
      if (emptyEl) emptyEl.hidden = courses.length > 0;

      if (listContainer) {
        listContainer.innerHTML = courses
          .map((c) => {
            const isEnrolled = enrolledCourseIds.has(c._id);
            const priceLabel = formatCurrency(c.price);

            return `
              <article class="course-card-item">
                ${
                  c.thumbnailUrl
                    ? `
                  <div class="course-card-thumb">
                    <img src="${escapeHtml(c.thumbnailUrl)}" alt="${escapeHtml(c.title)}" loading="lazy" onerror="this.onerror=null; this.parentElement.style.display='none';" />
                  </div>
                `
                    : ""
                }
                <div class="course-card-main">
                  <div class="course-badges-row">
                    <span class="course-badge">${escapeHtml(c.category || "General")}</span>
                    <span class="course-badge" style="background:var(--surface-2); border-color:var(--line);">${escapeHtml(c.difficulty || "Beginner")}</span>
                    ${isEnrolled ? `<span class="active-pill">✓ Enrolled</span>` : ""}
                  </div>
                  <h3>${escapeHtml(c.title)}</h3>
                  <p>${escapeHtml(c.description || "No description provided.")}</p>
                  <small style="color:var(--muted);">Instructor: ${escapeHtml(c.instructorId?.fullName || "Vertex Instructor")}</small>
                </div>
                <div class="course-actions">
                  <span class="course-price">${priceLabel}</span>
                  ${
                    isEnrolled
                      ? `<a class="button button-primary mini-button" href="#/student/player?courseId=${escapeHtml(c._id)}">Go to Course →</a>`
                      : `<button class="button button-secondary mini-button" type="button" data-enroll-id="${escapeHtml(c._id)}">Enroll Now</button>`
                  }
                </div>
              </article>
            `;
          })
          .join("");
      }
    } catch (error) {
      toast(`Failed to load catalog: ${errorText(error)}`, "error");
    }
  }

  filterForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(filterForm));
    loadData(data);
  });

  listContainer?.addEventListener("click", async (e) => {
    const enrollBtn = e.target.closest("[data-enroll-id]");
    if (!enrollBtn) return;

    const courseId = enrollBtn.dataset.enrollId;
    setBusy(enrollBtn, true, "Enrolling…");

    try {
      await enrollmentService.enroll(courseId);
      toast("Enrolled successfully! Enjoy your course.");
      enrolledCourseIds.add(courseId);
      enrollBtn.outerHTML = `<a class="button button-primary mini-button" href="#/student/player?courseId=${escapeHtml(courseId)}">Go to Course →</a>`;
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(enrollBtn, false);
    }
  });

  await loadData();
}
