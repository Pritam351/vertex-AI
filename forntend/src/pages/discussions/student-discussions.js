import { discussionService } from "../../services/discussionService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { getSession } from "../../store/session.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { errorText } from "../../utils/validation.js";

export async function mountStudentDiscussions(container) {
  const courseSelect = $("#student-discussions-course-select", container);
  const composerCourseSelect = $("#student-thread-course-id", container);
  const refreshBtn = $("#btn-refresh-student-discussions", container);
  const toggleComposerBtn = $("#btn-toggle-student-new-thread", container);
  const cancelComposerBtn = $("#btn-cancel-student-new-thread", container);
  const cancelComposerBtn2 = $("#btn-cancel-student-new-thread-2", container);
  const composerPanel = $("#student-new-thread-panel", container);
  const composerForm = $("#student-new-thread-form", container);

  const btnFilterAll = $("#btn-filter-std-all", container);
  const btnFilterMine = $("#btn-filter-std-mine", container);

  const countPill = $("#std-discussions-count", container);
  const loadingEl = $("#std-discussions-loading", container);
  const emptyEl = $("#std-discussions-empty", container);
  const feedEl = $("#std-discussions-feed", container);

  let enrolledCourses = [];
  let allThreads = [];
  let activeFilter = "all"; // "all" | "mine"

  // 1. Populate Enrolled Courses
  async function loadCourses() {
    try {
      const res = await enrollmentService.getMyEnrollments();
      const enrollments = res?.data || (Array.isArray(res) ? res : []);
      enrolledCourses = enrollments
        .map(e => e.courseId)
        .filter(Boolean);

      if (courseSelect) {
        courseSelect.innerHTML = `<option value="all">All My Enrolled Courses</option>` +
          enrolledCourses.map(c => `<option value="${c._id}">${escapeHtml(c.title)}</option>`).join("");
      }

      if (composerCourseSelect) {
        composerCourseSelect.innerHTML = `<option value="">Choose course to ask in...</option>` +
          enrolledCourses.map(c => `<option value="${c._id}">${escapeHtml(c.title)}</option>`).join("");
      }
    } catch (err) {
      console.error("Failed to load enrolled courses:", err);
    }
  }

  // 2. Load Discussions
  async function loadDiscussions() {
    if (loadingEl) {
      loadingEl.hidden = false;
      loadingEl.style.display = "block";
    }
    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }
    if (feedEl) feedEl.innerHTML = "";

    const selectedCourse = courseSelect?.value || "all";
    try {
      const res = await discussionService.getUserDiscussions({
        courseId: selectedCourse !== "all" ? selectedCourse : null
      });
      allThreads = res?.data || [];
      renderFeed();
    } catch (err) {
      console.error("Failed to load discussions:", err);
      if (loadingEl) {
        loadingEl.hidden = true;
        loadingEl.style.display = "none";
      }
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "block";
        emptyEl.innerHTML = `<div class="empty-icon">⚠️</div><h3>Failed to load discussions</h3><p style="color:var(--text-secondary);">${errorText(err)}</p>`;
      }
    }
  }

  // 3. Render Feed
  function renderFeed() {
    if (loadingEl) {
      loadingEl.hidden = true;
      loadingEl.style.display = "none";
    }

    const session = getSession();
    const currentUserId = String(session?.user?.id || session?.user?._id || "");

    let threads = allThreads || [];
    if (activeFilter === "mine") {
      threads = threads.filter(t => {
        const creatorId = String(t.createdBy?._id || t.createdBy || "");
        return creatorId === currentUserId;
      });
    }

    if (countPill) {
      countPill.textContent = `${threads.length} ${threads.length === 1 ? "discussion" : "discussions"}`;
    }

    if (!threads.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "block";
        emptyEl.innerHTML = `
          <div class="empty-icon" style="font-size:2.5rem; margin-bottom:0.75rem;">💬</div>
          <h3>${activeFilter === "mine" ? "You haven't asked any questions yet" : "No discussions found"}</h3>
          <p style="color:var(--text-secondary); margin:0.35rem 0 0 0;">${activeFilter === "mine" ? "Click '+ Ask Question' above to post your first topic!" : "Be the first to ask a question or start a conversation in your enrolled courses!"}</p>
        `;
      }
      if (feedEl) feedEl.innerHTML = "";
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }

    feedEl.innerHTML = threads.map((thread) => {
      const courseTitle = escapeHtml(thread.courseId?.title || "Enrolled Course");
      const courseId = thread.courseId?._id || thread.courseId;
      const authorName = escapeHtml(thread.createdBy?.fullName || thread.createdBy?.name || "Student");
      const authorRole = (thread.createdBy?.role || "student").toLowerCase();
      const isInstructor = authorRole === "instructor" || authorRole === "admin";
      const title = escapeHtml(thread.title);
      const content = escapeHtml(thread.content).replace(/\n/g, "<br>");
      const dateStr = thread.createdAt ? new Date(thread.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) : "";

      const lectureTag = thread.lectureTitle
        ? `<span style="background:rgba(99,102,241,0.12); color:#a5b4fc; border:1px solid rgba(99,102,241,0.25); border-radius:4px; font-size:0.7rem; padding:0.15rem 0.45rem; font-weight:500;">🎬 ${escapeHtml(thread.lectureTitle)}</span>`
        : "";

      const posts = thread.posts || [];
      const isAnswered = posts.length > 0;

      return `
        <div class="panel form-panel" style="background:#11192d; border:1px solid ${thread.isFlagged ? "rgba(245,158,11,0.4)" : "#27314b"}; border-radius:10px; padding:1.25rem;">
          <!-- Top Course & Author Row -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.75rem;">
            <div style="display:flex; flex-direction:column; gap:0.35rem;">
              <span style="font-size:0.78rem; color:#818cf8; font-weight:700;">📚 ${courseTitle}</span>
              <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                <span style="background:rgba(99,102,241,0.22); color:#c7d2fe; width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem;">
                  ${authorName.charAt(0).toUpperCase()}
                </span>
                <strong style="font-size:0.88rem; color:#f8fafc;">${authorName}</strong>
                ${isInstructor ? `<span class="status published" style="font-size:0.6rem; padding:0.12rem 0.4rem; font-weight:700;">INSTRUCTOR</span>` : `<span style="font-size:0.62rem; color:#9da4c2; background:rgba(255,255,255,0.05); padding:0.12rem 0.4rem; border-radius:4px;">STUDENT</span>`}
                ${lectureTag}
                ${thread.isLocked ? `<span class="status" style="background:rgba(239,68,68,0.15); color:#fca5a5; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:700;">🔒 LOCKED</span>` : ""}
                ${isAnswered ? `<span class="status" style="background:rgba(34,197,94,0.12); color:#86efac; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;">✓ ${posts.length} ${posts.length === 1 ? "Reply" : "Replies"}</span>` : `<span class="status" style="background:rgba(245,158,11,0.12); color:#fde047; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;">Needs Answer</span>`}
              </div>
            </div>
            <span style="font:500 0.68rem 'DM Mono', monospace; color:#9da4c2;">${dateStr}</span>
          </div>

          <!-- Question Content -->
          <div style="margin-top:0.75rem;">
            <h4 style="margin:0 0 0.4rem 0; font-size:1.02rem; font-weight:700; color:#f8fafc;">${title}</h4>
            <div style="font-size:0.85rem; color:#cbd5e1; line-height:1.6; word-break:break-word;">
              ${content}
            </div>
          </div>

          <!-- Action bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.85rem; padding-top:0.65rem; border-top:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <button type="button" class="mini-button" data-action="toggle-student-replies" data-thread-id="${thread._id}" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.65rem;">
                <span>💬</span>
                <span>${posts.length} ${posts.length === 1 ? "Reply" : "Replies"}</span>
              </button>
              <button type="button" class="mini-button button-subtle" data-action="report-student-thread" data-thread-id="${thread._id}" title="Report inappropriate content" style="border:none; background:transparent; color:#9da4c2; font-size:0.75rem; cursor:pointer;">
                🚩 Report
              </button>
            </div>
            ${courseId ? `
              <a href="#/student/player?courseId=${courseId}&tab=discussions" class="mini-button button-secondary" style="font-size:0.75rem; text-decoration:none; padding:0.3rem 0.65rem; display:inline-flex; align-items:center; gap:0.3rem;">
                Open in Course Player →
              </a>
            ` : ""}
          </div>

          <!-- Replies Drawer -->
          <div id="std-replies-${thread._id}" class="student-replies-drawer" style="display:none; margin-top:0.85rem; padding-top:0.75rem; border-top:1px dashed rgba(255,255,255,0.08);">
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${posts.map(p => {
                const pAuthor = escapeHtml(p.userId?.fullName || p.userId?.name || "Participant");
                const pRole = (p.userId?.role || "student").toLowerCase();
                const pIsInst = pRole === "instructor" || pRole === "admin";
                const pContent = escapeHtml(p.content).replace(/\n/g, "<br>");
                const pDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                }) : "";
                return `
                  <div style="background:#0b1022; border:1px solid ${pIsInst ? "rgba(99,102,241,0.3)" : "#1e293b"}; border-radius:8px; padding:0.75rem 0.9rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                      <div style="display:flex; align-items:center; gap:0.45rem;">
                        <span style="background:${pIsInst ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)"}; color:#c7d2fe; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700;">
                          ${pAuthor.charAt(0).toUpperCase()}
                        </span>
                        <strong style="font-size:0.82rem; color:#f8fafc;">${pAuthor}</strong>
                        ${pIsInst ? `<span class="status published" style="font-size:0.6rem; padding:0.1rem 0.35rem; font-weight:700;">INSTRUCTOR</span>` : `<span style="font-size:0.62rem; color:#9da4c2; background:rgba(255,255,255,0.05); padding:0.1rem 0.35rem; border-radius:3px;">STUDENT</span>`}
                      </div>
                      <div style="display:flex; align-items:center; gap:0.4rem;">
                        <span style="font:500 0.65rem 'DM Mono', monospace; color:#9da4c2;">${pDate}</span>
                        <button type="button" class="mini-button button-subtle" data-action="report-student-reply" data-thread-id="${thread._id}" data-post-id="${p._id}" title="Report reply" style="padding:0.1rem 0.35rem; font-size:0.65rem; border:none; background:transparent; color:#9da4c2; cursor:pointer;">
                          🚩
                        </button>
                      </div>
                    </div>
                    <div style="font-size:0.8rem; color:#cbd5e1; line-height:1.5; word-break:break-word;">
                      ${pContent}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <!-- Reply Form -->
            ${!thread.isLocked ? `
              <form class="student-reply-form" data-thread-id="${thread._id}" style="display:flex; gap:0.5rem; margin-top:0.75rem; align-items:flex-start;">
                <textarea name="replyContent" class="student-reply-input" required maxlength="5000" rows="1" placeholder="Write a reply..." style="flex:1; padding:0.6rem 0.8rem; min-height:40px; resize:vertical; font-size:0.82rem; background:#0d1425; border:1px solid #313b57; border-radius:6px; color:#f8fafc;"></textarea>
                <button type="submit" class="button button-primary mini-button" style="padding:0.6rem 1rem; height:40px; font-size:0.8rem;">
                  Reply
                </button>
              </form>
            ` : `
              <p style="color:#f87171; font-size:0.75rem; margin:0.5rem 0 0 0;">🔒 This thread has been locked.</p>
            `}
          </div>
        </div>
      `;
    }).join("");
  }

  // 4. Wire Events
  courseSelect?.addEventListener("change", loadDiscussions);
  refreshBtn?.addEventListener("click", loadDiscussions);

  // Filter toggles
  btnFilterAll?.addEventListener("click", () => {
    activeFilter = "all";
    btnFilterAll.classList.add("is-active");
    btnFilterAll.style.background = "#28205e";
    btnFilterAll.style.color = "#fff";
    btnFilterMine.classList.remove("is-active");
    btnFilterMine.style.background = "transparent";
    btnFilterMine.style.color = "#9da4c2";
    renderFeed();
  });

  btnFilterMine?.addEventListener("click", () => {
    activeFilter = "mine";
    btnFilterMine.classList.add("is-active");
    btnFilterMine.style.background = "#28205e";
    btnFilterMine.style.color = "#fff";
    btnFilterAll.classList.remove("is-active");
    btnFilterAll.style.background = "transparent";
    btnFilterAll.style.color = "#9da4c2";
    renderFeed();
  });

  // Composer toggles
  toggleComposerBtn?.addEventListener("click", () => {
    if (composerPanel) {
      composerPanel.hidden = !composerPanel.hidden;
      if (!composerPanel.hidden) {
        $("#student-thread-title-input", container)?.focus();
      }
    }
  });

  const closeComposer = () => {
    if (composerPanel) composerPanel.hidden = true;
  };
  cancelComposerBtn?.addEventListener("click", closeComposer);
  cancelComposerBtn2?.addEventListener("click", closeComposer);

  // Submit new thread
  composerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const courseIdInput = $("#student-thread-course-id", container);
    const titleInput = $("#student-thread-title-input", container);
    const contentInput = $("#student-thread-content-input", container);
    const submitBtn = $("#btn-submit-student-thread", container);

    const targetCourseId = courseIdInput?.value;
    const title = titleInput?.value?.trim();
    const content = contentInput?.value?.trim();

    if (!targetCourseId) {
      toast("Please select an enrolled course", "error");
      courseIdInput?.focus();
      return;
    }
    if (!title || title.length < 3) {
      toast("Title must be at least 3 characters", "error");
      titleInput?.focus();
      return;
    }
    if (!content) {
      toast("Question details cannot be empty", "error");
      contentInput?.focus();
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      await discussionService.createThread({
        courseId: targetCourseId,
        title,
        content
      });
      toast("Question posted successfully! 💬", "success");
      composerForm.reset();
      closeComposer();
      // Select that course or all
      if (courseSelect) courseSelect.value = targetCourseId;
      await loadDiscussions();
    } catch (err) {
      toast(`Failed to post question: ${errorText(err)}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Delegated feed events
  feedEl?.addEventListener("click", async (e) => {
    // Toggle replies
    const toggleBtn = e.target.closest('[data-action="toggle-student-replies"]');
    if (toggleBtn) {
      const threadId = toggleBtn.dataset.threadId;
      const drawer = $(`#std-replies-${threadId}`, container);
      if (drawer) {
        drawer.style.display = drawer.style.display === "none" ? "block" : "none";
      }
      return;
    }

    // Report thread
    const reportThreadBtn = e.target.closest('[data-action="report-student-thread"]');
    if (reportThreadBtn) {
      const threadId = reportThreadBtn.dataset.threadId;
      const reason = prompt("Reason for reporting this thread (e.g. spam, offensive language):");
      if (reason !== null) {
        try {
          await discussionService.reportThread(threadId, reason);
          toast("Thread reported to moderators. Thank you.", "info");
          await loadDiscussions();
        } catch (err) {
          toast(`Could not report thread: ${errorText(err)}`, "error");
        }
      }
      return;
    }

    // Report reply
    const reportReplyBtn = e.target.closest('[data-action="report-student-reply"]');
    if (reportReplyBtn) {
      const threadId = reportReplyBtn.dataset.threadId;
      const postId = reportReplyBtn.dataset.postId;
      const reason = prompt("Reason for reporting this reply:");
      if (reason !== null) {
        try {
          await discussionService.reportPost(threadId, postId, reason);
          toast("Comment reported to moderators. Thank you.", "info");
          await loadDiscussions();
        } catch (err) {
          toast(`Could not report reply: ${errorText(err)}`, "error");
        }
      }
      return;
    }
  });

  // Delegated reply form submit
  feedEl?.addEventListener("submit", async (e) => {
    const form = e.target.closest(".student-reply-form");
    if (!form) return;
    e.preventDefault();
    const threadId = form.dataset.threadId;
    const input = form.querySelector(".student-reply-input");
    const content = input?.value?.trim();
    if (!content) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await discussionService.replyToThread(threadId, { content });
      toast("Reply posted! 💬", "success");
      if (input) input.value = "";
      await loadDiscussions();
      // Keep drawer open
      const drawer = $(`#std-replies-${threadId}`, container);
      if (drawer) drawer.style.display = "block";
    } catch (err) {
      toast(`Failed to post reply: ${errorText(err)}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  await loadCourses();
  await loadDiscussions();
}

