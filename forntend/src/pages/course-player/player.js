/**
 * player.js — VertexLearn AI Course Player (complete rewrite)
 *
 * Features:
 *  - Two-column layout: video+tabs (left) | curriculum (right)
 *  - Topbar: breadcrumb, course progress, Completed badge, AI Tutor shortcut
 *  - Native video: play/pause, prev/next, bookmark toggle, speed select, duration badge
 *  - YouTube iframe: graceful fallback (no resume/speed)
 *  - Tabs: Lesson Overview, Personal Notes (auto-save + debounce), Saved Bookmarks, AI Tutor Chat
 *  - Curriculum sidebar: module groups (collapsible), completion circles, active highlight
 *  - Progress reporting: localStorage for resume position, backend for completion
 *  - Bookmark toggle via learningService
 *  - Notes auto-save with 1.5s debounce
 */

import { courseService }    from "../../services/courseService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { learningService }  from "../../services/learningService.js";
import { aiService }        from "../../services/aiService.js";
import { certificateService } from "../../services/certificateService.js";
import { announcementService } from "../../services/announcementService.js";
import { discussionService }   from "../../services/discussionService.js";
import { getSession }          from "../../store/session.js";
import { openCertificateModal } from "../../components/common/certificate-modal.js";
import { escapeHtml }       from "../../utils/dom.js";
import { toast }            from "../../components/common/toast.js";
import { errorText }        from "../../utils/validation.js";
import { openModal }        from "../../components/common/modal.js";
import { openReportModal }   from "../../components/common/report-modal.js";

// ─── Module-level state (reset on every mount) ────────────────────────────────
let container        = null;
let currentCourse    = null;
let currentModules   = [];           // [{ _id, title, orderIndex, lectures:[…] }]
let activeLecture    = null;
let activeModuleTitle = "";
let flatLectures     = [];           // ordered flat list for prev/next
let lectureProgressMap = new Map();  // lectureId → { watchedSeconds, completed }
let bookmarksCache  = [];           // all bookmarks from GET /bookmarks/me
let isBookmarked    = false;
let notesSaveTimer  = null;
let activeTab       = "lesson-overview";
let progressTimerInterval = null;   // setInterval handle for localStorage saves
let isYouTube       = false;
let enrollment      = null;         // current enrollment object
let activeChatSessionId = null;
let chatSessions    = [];
let courseAnnouncements = [];
let courseDiscussions = [];
let discussionsFilter = "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const qs = (sel) => container?.querySelector(sel);

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getLSProgress(lectureId) {
  try {
    const raw = localStorage.getItem(`vertex:progress:${lectureId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setLSProgress(lectureId, data) {
  try {
    localStorage.setItem(`vertex:progress:${lectureId}`, JSON.stringify(data));
  } catch { /* storage full */ }
}

function setLastLecture(courseId, data) {
  try {
    localStorage.setItem(`vertex:lastLecture:${courseId}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function renderTopbar() {
  const bcCourse  = qs("#player-bc-course");
  const bcModule  = qs("#player-bc-module");
  const bcLecture = qs("#player-bc-lecture");
  const fill      = qs("#player-progress-fill");
  const pct       = qs("#player-progress-pct");
  const badge     = qs("#player-completed-badge");

  if (bcCourse)  bcCourse.textContent  = currentCourse?.title || "Course";
  if (bcModule)  bcModule.textContent  = activeModuleTitle || "";
  if (bcLecture) bcLecture.textContent = activeLecture?.title || "";

  const percent = enrollment?.progressPercent ?? 0;
  if (fill)  fill.style.width = `${percent}%`;
  if (pct)   pct.textContent  = `${Math.round(percent)}%`;
  if (badge) badge.hidden = percent < 100;

  const certBtn = qs("#btn-player-cert");
  if (certBtn) certBtn.hidden = percent < 100;

  // sidebar mirror
  const sf  = qs("#sidebar-progress-fill");
  const st  = qs("#sidebar-progress-text");
  if (sf) sf.style.width = `${percent}%`;
  const countsBadge = qs("#sidebar-counts-badge");
  const totalMods = currentModules.length;
  const totalLecs = flatLectures.length;
  if (countsBadge) {
    countsBadge.textContent = `${totalMods} ${totalMods === 1 ? "Module" : "Modules"} • ${totalLecs} ${totalLecs === 1 ? "Lecture" : "Lectures"}`;
  }
  const stText = qs("#sidebar-progress-text");
  if (stText) {
    const totalCompleted = flatLectures.filter(fl => lectureProgressMap.get(fl.lec._id)?.completed).length;
    stText.textContent = `${totalCompleted}/${totalLecs} Completed (${Math.round(percent)}%)`;
  }
  if (st) st.textContent = `${Math.round(percent)}% Course Progress`;
}

// ─── Curriculum ───────────────────────────────────────────────────────────────
function renderCurriculum() {
  const tree = qs("#player-curriculum-tree");
  if (!tree) return;

  if (!currentModules.length) {
    tree.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:1rem 0;">No modules added yet.</p>';
    return;
  }

  // Populate or refresh Jump selectors
  const jumpSelectors = [qs("#player-jump-select"), qs("#player-jump-select-top")].filter(Boolean);
  if (jumpSelectors.length && flatLectures.length) {
    const currentVal = activeLecture?._id || "";
    const optionsHtml = `<option value="">⚡ Jump to lesson (${flatLectures.length} total)…</option>` +
      flatLectures.map((fl, idx) => {
        const isSel = String(fl.lec._id) === String(currentVal) ? "selected" : "";
        const prog = lectureProgressMap.get(fl.lec._id);
        const check = prog?.completed ? "✓ " : "";
        return `<option value="${fl.lec._id}" ${isSel}>${check}Lesson ${idx + 1}: ${escapeHtml(fl.lec.title)}</option>`;
      }).join("");
    jumpSelectors.forEach(sel => { sel.innerHTML = optionsHtml; });
  }

  tree.innerHTML = currentModules.map((mod, modIdx) => {
    const lectures = mod.lectures || [];
    const modCompleted = lectures.filter(l => lectureProgressMap.get(l._id)?.completed).length;
    const modTotal     = lectures.length;

    // Check if this module contains the currently active lecture
    const containsActive = activeLecture && lectures.some(l => String(l._id) === String(activeLecture._id));

    const lecturesHtml = lectures.map((lec, lecIdx) => {
      const prog      = lectureProgressMap.get(lec._id) || {};
      const completed = !!prog.completed;
      const isActive  = activeLecture?._id === lec._id;
      const dur       = lec.durationSeconds ? formatDuration(lec.durationSeconds) : "";
      const globalIdx = flatLectures.findIndex(fl => String(fl.lec._id) === String(lec._id));
      const lessonNumber = globalIdx !== -1 ? (globalIdx + 1) : (lecIdx + 1);

      const circleInner = completed
        ? `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="10" cy="10" r="9" stroke="#52d8c2" stroke-width="1.5" fill="rgba(82,216,194,0.12)"/>
             <path d="M6 10.5l2.5 2.5 5-5" stroke="#52d8c2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`
        : `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="10" cy="10" r="9" stroke="var(--muted, #94a3b8)" stroke-width="1.5" fill="none"/>
           </svg>`;

      return `
        <div
          class="curriculum-lecture-item${isActive ? " is-active-lecture" : ""}${completed ? " is-completed" : ""}"
          data-lecture-id="${lec._id}"
          data-mod-idx="${modIdx}"
          data-lec-idx="${lecIdx}"
          role="button"
          tabindex="0"
          aria-label="Lesson ${lessonNumber}: ${escapeHtml(lec.title)}${completed ? " (completed)" : ""}"
          title="Lesson ${lessonNumber}: ${escapeHtml(lec.title)}"
          style="display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 1rem 0.6rem 1.1rem; cursor: pointer; transition: background 0.15s; border-left: 3px solid ${isActive ? "var(--violet, #7b61ff)" : "transparent"}; background: ${isActive ? "rgba(123, 97, 255, 0.12)" : "transparent"};"
        >
          <span class="lecture-completion-circle" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${circleInner}</span>
          <span class="lecture-item-title" style="flex: 1; min-width: 0; font-size: 0.82rem; line-height: 1.35; color: ${isActive ? "var(--violet-light, #c4b5fd)" : "var(--ink, #f1f5f9)"}; font-weight: ${isActive ? "600" : "500"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${lessonNumber}. ${escapeHtml(lec.title)}
          </span>
          ${dur ? `<span class="lecture-item-dur" style="font-size: 0.72rem; font-family: 'DM Mono', monospace; color: var(--muted, #94a3b8); flex-shrink: 0;">${dur}</span>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="curriculum-module-group" id="mod-group-${modIdx}" style="border-bottom: 1px solid var(--line, #232f48);">
        <button
          class="curriculum-module-header"
          type="button"
          aria-expanded="true"
          data-mod-idx="${modIdx}"
          title="Toggle module"
          style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: none; cursor: pointer; text-align: left; transition: background 0.15s;"
        >
          <div style="flex: 1; min-width: 0; padding-right: 0.5rem;">
            <span class="curriculum-module-num" style="display: block; font-size: 0.7rem; font-family: 'DM Mono', monospace; color: var(--violet-light, #a78bfa); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;">
              MODULE ${mod.orderIndex ?? modIdx + 1}
            </span>
            <span class="curriculum-module-title" style="font-size: 0.84rem; font-weight: 600; color: var(--ink, #f1f5f9); line-height: 1.35; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(mod.title)}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <span class="curriculum-module-meta" style="font-size: 0.74rem; font-family: 'DM Mono', monospace; color: var(--muted, #94a3b8);">
              ${modCompleted}/${modTotal}
            </span>
            <span class="curriculum-module-chevron" aria-hidden="true" style="font-size: 0.75rem; color: var(--muted, #94a3b8); transition: transform 0.2s;">▾</span>
          </div>
        </button>
        <div class="curriculum-module-body" id="mod-body-${modIdx}" style="display: flex; flex-direction: column;">
          ${lecturesHtml || '<p style="color:var(--muted);font-size:0.83rem;padding:0.5rem;">No lectures yet.</p>'}
        </div>
      </div>
    `;
  }).join("");

  // Collapse/expand module headers
  tree.querySelectorAll(".curriculum-module-header").forEach(header => {
    header.addEventListener("click", () => {
      const idx  = header.dataset.modIdx;
      const body = tree.querySelector(`#mod-body-${idx}`);
      const expanded = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!expanded));
      const chevron = header.querySelector(".curriculum-module-chevron");
      if (chevron) chevron.textContent = expanded ? "▸" : "▾";
      if (body) body.hidden = expanded;
    });
  });

  // Lecture click / keyboard
  tree.querySelectorAll(".curriculum-lecture-item").forEach(item => {
    const handler = () => {
      const mi  = Number(item.dataset.modIdx);
      const li  = Number(item.dataset.lecIdx);
      const mod = currentModules[mi];
      const lec = mod?.lectures?.[li];
      if (lec) selectLecture(lec, mod.title);
    };
    item.addEventListener("click", handler);
    item.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") handler(); });
  });

  // Auto-scroll active lecture into view
  setTimeout(() => {
    const activeItem = tree.querySelector(".curriculum-lecture-item.is-active-lecture");
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, 50);
}
// ─── Video helpers ────────────────────────────────────────────────────────────
function getVideoEl() {
  return qs("#player-video-container video");
}

function stopProgressInterval() {
  if (progressTimerInterval) {
    clearInterval(progressTimerInterval);
    progressTimerInterval = null;
  }
}

/**
 * Save current video position to localStorage (called every 5s + on switch/unload).
 */
function savePositionToLS() {
  const vid = getVideoEl();
  if (!vid || !activeLecture) return;
  const local = getLSProgress(activeLecture._id) || {};
  setLSProgress(activeLecture._id, {
    ...local,
    watchedSeconds: Math.floor(vid.currentTime)
  });
}

/**
 * Push a "progress update" to backend (non-completing).
 * Swallowed silently – not critical path.
 */
async function pushProgressToBackend(lectureId, watchedSeconds, completed = false) {
  try {
    const res = await enrollmentService.updateProgress(lectureId, { watchedSeconds, completed });
    // res may contain { progressPercent, completedLectures, totalLectures, completed, lectureId }
    if (res?.data) {
      const d = res.data;
      if (typeof d.progressPercent === "number" && enrollment) {
        enrollment.progressPercent = d.progressPercent;
      }
      if (d.lectureId) {
        const existing = lectureProgressMap.get(d.lectureId) || {};
        lectureProgressMap.set(d.lectureId, { ...existing, watchedSeconds: d.watchedSeconds ?? watchedSeconds, completed: d.completed ?? completed });
      }
    }
  } catch { /* silent */ }
}

async function refreshEnrollment(courseId) {
  try {
    const [enrollRes, progressRes] = await Promise.allSettled([
      enrollmentService.getMyEnrollmentForCourse(courseId),
      enrollmentService.getCourseProgress(courseId)
    ]);
    if (enrollRes.status === "fulfilled") enrollment = enrollRes.value;
    if (progressRes.status === "fulfilled") {
      const records = progressRes.value?.data?.lectureProgress || [];
      for (const r of records) {
        const existing = lectureProgressMap.get(String(r.lectureId)) || {};
        lectureProgressMap.set(String(r.lectureId), {
          ...existing,
          completed: r.completed ?? existing.completed,
        });
      }
    }
  } catch { /* ignore */ }
}

// ─── Video rendering ──────────────────────────────────────────────────────────
function renderVideo(lecture) {
  const vcEl          = qs("#player-video-container");
  const controlsBar   = qs("#player-controls-bar");
  const ytNote        = qs("#player-yt-note");
  const durationBadge = qs("#player-duration-badge");
  const playPauseIcon = qs("#play-pause-icon");

  if (!vcEl) return;

  stopProgressInterval();

  const url = lecture.videoUrl || "";
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);

  if (url && ytMatch?.[1]) {
    // ── YouTube embed ──────────────────────────────────────────────
    isYouTube = true;
    const embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    vcEl.innerHTML = `<iframe
      src="${embedUrl}"
      style="width:100%;height:100%;border:0;"
      allowfullscreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      title="${escapeHtml(lecture.title)}"
    ></iframe>`;
    if (controlsBar) controlsBar.hidden = true;
    if (ytNote) ytNote.hidden = false;

  } else if (url) {
    // ── Native <video> ─────────────────────────────────────────────
    isYouTube = false;
    vcEl.innerHTML = `<video
      src="${escapeHtml(url)}"
      style="width:100%;height:100%;display:block;"
      preload="metadata"
    ></video>`;
    if (controlsBar) controlsBar.hidden = false;
    if (ytNote) ytNote.hidden = true;

    const vid = getVideoEl();
    if (!vid) return;

    // Restore playback speed from localStorage
    const lsData = getLSProgress(lecture._id);
    if (lsData?.speed) vid.playbackRate = lsData.speed;
    const speedSel = qs("#player-speed-select");
    if (speedSel) speedSel.value = String(lsData?.speed || 1);

    // Resume position
    vid.addEventListener("canplay", () => {
      if (lsData?.watchedSeconds > 5) {
        vid.currentTime = lsData.watchedSeconds;
      }
    }, { once: true });

    // Update duration badge + play/pause icon
    vid.addEventListener("loadedmetadata", () => {
      if (durationBadge) durationBadge.textContent = `0:00 / ${formatDuration(vid.duration)}`;
    });

    vid.addEventListener("timeupdate", () => {
      if (durationBadge) {
        durationBadge.textContent = `${formatDuration(vid.currentTime)} / ${formatDuration(vid.duration)}`;
      }
    });

    // Play/pause icon sync
    vid.addEventListener("play",  () => { if (playPauseIcon) playPauseIcon.textContent = "⏸ Pause"; });
    vid.addEventListener("pause", () => { if (playPauseIcon) playPauseIcon.textContent = "▶ Play"; });
    vid.addEventListener("ended", () => { if (playPauseIcon) playPauseIcon.textContent = "↺ Replay"; });

    // Save to localStorage every 5s
    progressTimerInterval = setInterval(savePositionToLS, 5000);

    // Auto-complete at 90%
    vid.addEventListener("timeupdate", () => {
      if (!activeLecture) return;
      const prog = lectureProgressMap.get(activeLecture._id) || {};
      if (!prog.completed && vid.duration > 0 && vid.currentTime / vid.duration >= 0.9) {
        handleLectureComplete(activeLecture._id, vid.duration);
      }
    });

    // On ended: also complete
    vid.addEventListener("ended", () => {
      if (activeLecture) handleLectureComplete(activeLecture._id, vid.duration);
    });

  } else {
    // ── Text / Reading lesson ─────────────────────────────────────
    isYouTube = false;
    vcEl.innerHTML = `
      <div class="player-text-lesson">
        <p style="font-size:1.15rem;margin-bottom:0.5rem;">📖 Text / Reading Lesson</p>
        <p style="color:var(--muted);font-size:0.9rem;">Review the lesson notes and transcript in the Lesson Overview tab below.</p>
      </div>`;
    if (controlsBar) controlsBar.hidden = true;
    if (ytNote) ytNote.hidden = true;
  }
}

// ─── Lecture complete ─────────────────────────────────────────────────────────
async function handleLectureComplete(lectureId, watchedSeconds) {
  const existing = lectureProgressMap.get(lectureId) || {};
  if (existing.completed) return; // already done

  lectureProgressMap.set(lectureId, { ...existing, watchedSeconds: Math.floor(watchedSeconds || 0), completed: true });
  setLSProgress(lectureId, { ...(getLSProgress(lectureId) || {}), watchedSeconds: Math.floor(watchedSeconds || 0) });

  // Update mark-complete button
  const btnMC = qs("#btn-mark-complete");
  if (btnMC) { btnMC.textContent = "Completed ✓"; btnMC.disabled = true; }

  toast("Lecture completed! Great work! 🎉");

  try {
    const res = await enrollmentService.updateProgress(lectureId, {
      watchedSeconds: Math.floor(watchedSeconds || 0),
      completed: true
    });
    if (res?.data && typeof res.data.progressPercent === "number" && enrollment) {
      enrollment.progressPercent = res.data.progressPercent;
    }
  } catch (err) {
    toast(`Could not save progress: ${errorText(err)}`, "error");
  }

  await refreshEnrollment(currentCourse?._id);
  renderTopbar();
  renderCurriculum();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tabName) {
  activeTab = tabName;

  // Button states
  container.querySelectorAll(".player-tab-btn").forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  // Panel visibility
  container.querySelectorAll(".player-tab-content").forEach(panel => {
    panel.hidden = panel.id !== `tab-${tabName}`;
    panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
  });

  if (tabName === "saved-bookmarks") renderBookmarksTab();
  if (tabName === "personal-notes") qs("#notes-textarea")?.focus();
  if (tabName === "announcements") renderPlayerAnnouncements();
  if (tabName === "discussions") renderPlayerDiscussions();
}

// ─── Course Announcements tab ────────────────────────────────────────────────
async function loadCourseAnnouncements(courseId) {
  const loadingEl = qs("#player-announcements-loading");
  const emptyEl = qs("#player-announcements-empty");
  const listEl = qs("#player-announcements-list");
  const countBadge = qs("#announcements-count-badge");

  if (loadingEl) loadingEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;
  if (listEl) listEl.innerHTML = "";

  try {
    const res = await announcementService.getCourseAnnouncements(courseId);
    courseAnnouncements = res?.data || res || [];
    if (countBadge) {
      countBadge.textContent = courseAnnouncements.length ? `(${courseAnnouncements.length})` : "";
    }
    renderPlayerAnnouncements();
  } catch (err) {
    console.error("Failed to load announcements:", err);
    if (loadingEl) loadingEl.hidden = true;
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.innerHTML = `<p style="color:var(--text-secondary);margin:0;">Could not load announcements at this time.</p>`;
    }
  }
}

function renderPlayerAnnouncements() {
  const loadingEl = qs("#player-announcements-loading");
  const emptyEl = qs("#player-announcements-empty");
  const listEl = qs("#player-announcements-list");
  if (!listEl) return;

  if (loadingEl) loadingEl.hidden = true;

  if (!courseAnnouncements || courseAnnouncements.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = "";
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  listEl.innerHTML = courseAnnouncements.map((ann) => {
    const instructorName = escapeHtml(ann.instructorId?.name || "Instructor");
    const title = escapeHtml(ann.title);
    const content = escapeHtml(ann.content).replace(/\n/g, "<br>");
    const dateStr = ann.createdAt ? new Date(ann.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "";

    const pinnedBadge = ann.isPinned
      ? `<span class="status" style="color:#ffd68f; background:rgba(255,183,77,0.13); font-size:0.62rem; padding:0.2rem 0.45rem; font-weight:700;">PINNED</span>`
      : "";

    return `
      <div style="background:#11192d; border:1px solid ${ann.isPinned ? "rgba(234,179,8,0.4)" : "#27314b"}; border-radius:0.55rem; padding:1.15rem; display:flex; flex-direction:column; gap:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            ${pinnedBadge}
            <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:#f8fafc;">${title}</h4>
          </div>
          <span style="font:500 0.68rem 'DM Mono', monospace; color:#9da4c2;">${dateStr}</span>
        </div>
        <div style="font-size:0.82rem; line-height:1.6; color:#cbd5e1; word-break:break-word;">
          ${content}
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.2rem; font-size:0.75rem; color:#9da4c2; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.55rem;">
          <span style="background:rgba(99,102,241,0.2); color:#818cf8; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.72rem;">
            ${instructorName.charAt(0).toUpperCase()}
          </span>
          <span>Posted by <strong>${instructorName}</strong></span>
        </div>
      </div>
    `;
  }).join("");
}

// ─── Course Discussions & Forum ──────────────────────────────────────────────
async function loadCourseDiscussions(courseId) {
  const loadingEl = qs("#player-discussions-loading");
  const emptyEl = qs("#player-discussions-empty");
  const listEl = qs("#player-discussions-list");
  const countBadge = qs("#discussions-count-badge");

  if (loadingEl) {
    loadingEl.hidden = false;
    loadingEl.style.display = "block";
  }
  if (emptyEl) {
    emptyEl.hidden = true;
    emptyEl.style.display = "none";
  }
  if (listEl) listEl.innerHTML = "";

  try {
    const res = await discussionService.getCourseDiscussions(courseId);
    courseDiscussions = res?.data || [];
    renderPlayerDiscussions();
  } catch (err) {
    console.error("Failed to load discussions:", err);
    if (loadingEl) {
      loadingEl.hidden = true;
      loadingEl.style.display = "none";
    }
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.style.display = "block";
      emptyEl.innerHTML = `<p style="color:var(--text-secondary);margin:0;">Could not load discussions at this time.</p>`;
    }
  }
}

function renderPlayerDiscussions() {
  const loadingEl = qs("#player-discussions-loading");
  const emptyEl = qs("#player-discussions-empty");
  const listEl = qs("#player-discussions-list");
  const countBadge = qs("#discussions-count-badge");
  const lectureNameEl = qs("#player-disc-lecture-name");
  if (!listEl) return;

  if (loadingEl) {
    loadingEl.hidden = true;
    loadingEl.style.display = "none";
  }

  // Update lecture subtitle in tab
  if (lectureNameEl) {
    lectureNameEl.textContent = activeLecture?.title || "Current Lecture";
  }

  try {
    const session = getSession();
    const currentUser = session?.user;
    const isAdmin = currentUser && currentUser.role === "admin";

    // Filter threads strictly for the active lecture (and include previous legacy comments)
    let threads = (courseDiscussions || []).filter(t => {
      if (!activeLecture) return true;
      const tLecId = t.lectureId?._id || t.lectureId;
      // 1. Direct lectureId match
      if (tLecId && String(tLecId) === String(activeLecture._id)) return true;
      // 2. Direct lectureTitle match
      if (t.lectureTitle && activeLecture.title && t.lectureTitle.toLowerCase().trim() === activeLecture.title.toLowerCase().trim()) return true;
      // 3. Or previous legacy questions with no lecture attached
      if (!tLecId && !t.lectureTitle) return true;
      return false;
    });

    if (countBadge) {
      countBadge.textContent = threads.length ? `(${threads.length})` : "";
    }

    if (!threads.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "block";
        emptyEl.innerHTML = `
          <div class="empty-icon" style="font-size:2rem; margin-bottom:0.5rem;">💬</div>
          <p style="color:var(--text-secondary);margin:0;">No questions or comments for "${escapeHtml(activeLecture?.title || "this lecture")}" yet. Be the first to ask!</p>
        `;
      }
      listEl.innerHTML = "";
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }

    listEl.innerHTML = threads.map((thread) => {
      const authorName = escapeHtml(thread.createdBy?.fullName || thread.createdBy?.name || "Student");
      const authorRole = String(thread.createdBy?.role || "student").toLowerCase();
      const isThreadInstructor = authorRole === "instructor";
      const title = escapeHtml(thread.title || "Untitled Discussion");
      const content = escapeHtml(thread.content || "").replace(/\n/g, "<br>");
      const dateStr = thread.createdAt ? new Date(thread.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) : "";

      const roleBadge = isThreadInstructor
        ? `<span class="status published" style="font-size:0.62rem; padding:0.15rem 0.4rem; font-weight:700;">INSTRUCTOR</span>`
        : `<span style="font-size:0.65rem; color:#9da4c2; background:rgba(255,255,255,0.05); padding:0.15rem 0.4rem; border-radius:4px; font-weight:600;">STUDENT</span>`;

      const lectureTag = thread.lectureTitle
        ? `<span style="background:rgba(99,102,241,0.12); color:#a5b4fc; border:1px solid rgba(99,102,241,0.25); border-radius:4px; font-size:0.7rem; padding:0.15rem 0.45rem; font-weight:500;">🎬 ${escapeHtml(thread.lectureTitle)}</span>`
        : "";

      const lockedBadge = thread.isLocked
        ? `<span style="background:rgba(239,68,68,0.15); color:#fca5a5; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:700;">🔒 LOCKED</span>`
        : "";

      const isHiddenBadge = thread.isHidden
        ? `<span style="background:rgba(100,116,139,0.2); color:#94a3b8; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:700;">👁 HIDDEN</span>`
        : "";

      const isReportedBadge = thread.isFlagged
        ? `<span style="background:rgba(245,158,11,0.15); color:#fbbf24; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; font-weight:700;">🚩 REPORTED</span>`
        : "";

      const posts = thread.posts || [];
      const replyCount = posts.length;

      // Render replies HTML
      const repliesHtml = posts.map(post => {
        const pAuthorName = escapeHtml(post.userId?.fullName || post.userId?.name || "User");
        const pAuthorRole = String(post.userId?.role || "student").toLowerCase();
        const pIsInstructor = pAuthorRole === "instructor";
        const pContent = escapeHtml(post.content || "").replace(/\n/g, "<br>");
        const pDateStr = post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) : "";

        const pRoleBadge = pIsInstructor
          ? `<span class="status published" style="font-size:0.58rem; padding:0.1rem 0.35rem; font-weight:700;">INSTRUCTOR</span>`
          : `<span style="font-size:0.6rem; color:#9da4c2; background:rgba(255,255,255,0.05); padding:0.1rem 0.35rem; border-radius:3px;">STUDENT</span>`;

        return `
          <div class="discussion-reply-item" style="display:flex; flex-direction:column; gap:0.4rem; padding:0.75rem 0.9rem; background:#0b1022; border:1px solid #1e293b; border-radius:8px; margin-top:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:0.45rem;">
                <span style="background:rgba(99,102,241,0.18); color:#a5b4fc; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.68rem; font-weight:700;">${pAuthorName.charAt(0).toUpperCase()}</span>
                <strong style="font-size:0.8rem; color:#f8fafc;">${pAuthorName}</strong>
                ${pRoleBadge}
                ${post.isFlagged ? `<span style="color:#fbbf24; font-size:0.65rem;">🚩 Reported</span>` : ""}
                ${post.isHidden ? `<span style="color:#94a3b8; font-size:0.65rem;">👁 Hidden</span>` : ""}
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font:500 0.65rem 'DM Mono', monospace; color:#9da4c2;">${pDateStr}</span>
                <button type="button" class="mini-button button-subtle" data-action="report-post" data-thread-id="${thread._id}" data-post-id="${post._id}" title="Report inappropriate reply" style="padding:0.1rem 0.35rem; font-size:0.65rem; border:none; background:transparent; color:#9da4c2; cursor:pointer;">
                  🚩
                </button>
                ${isAdmin ? `
                  <button type="button" class="mini-button button-subtle" data-action="toggle-hide-post" data-thread-id="${thread._id}" data-post-id="${post._id}" data-is-hidden="${post.isHidden ? "true" : "false"}" style="padding:0.1rem 0.35rem; font-size:0.65rem;">
                    ${post.isHidden ? "Unhide" : "Hide"}
                  </button>
                ` : ""}
              </div>
            </div>
            <div style="font-size:0.78rem; line-height:1.5; color:#cbd5e1; word-break:break-word;">
              ${pContent}
            </div>
          </div>
        `;
      }).join("");

    return `
      <div class="created-item discussion-thread-item" style="display:flex; flex-direction:column; gap:0.75rem; padding:1.15rem; background:#11192d; border:1px solid #27314b; border-radius:10px;">
        <!-- Thread Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; width:100%;">
          <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
            <span style="background:rgba(99,102,241,0.22); color:#c7d2fe; width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem;">
              ${authorName.charAt(0).toUpperCase()}
            </span>
            <strong style="font-size:0.86rem; color:#f8fafc;">${authorName}</strong>
            ${roleBadge}
            ${lectureTag}
            ${lockedBadge}
            ${isHiddenBadge}
            ${isReportedBadge}
          </div>
          <span style="font:500 0.68rem 'DM Mono', monospace; color:#9da4c2;">${dateStr}</span>
        </div>

        <!-- Thread Title & Body -->
        <div style="display:flex; flex-direction:column; gap:0.35rem;">
          <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:#f8fafc;">${title}</h4>
          <div style="font-size:0.82rem; line-height:1.6; color:#cbd5e1; word-break:break-word;">
            ${content}
          </div>
        </div>

        <!-- Thread Footer Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.25rem; padding-top:0.6rem; border-top:1px solid rgba(255,255,255,0.06); width:100%;">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <button type="button" class="mini-button" data-action="toggle-replies" data-thread-id="${thread._id}" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.65rem;">
              <span>💬</span>
              <span>${replyCount} ${replyCount === 1 ? "Reply" : "Replies"}</span>
            </button>
            <button type="button" class="mini-button button-subtle" data-action="report-thread" data-thread-id="${thread._id}" title="Report thread" style="border:none; background:transparent; color:#9da4c2; font-size:0.75rem; cursor:pointer;">
              🚩 Report
            </button>
          </div>

          ${isAdmin ? `
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button type="button" class="mini-button" data-action="toggle-lock-thread" data-thread-id="${thread._id}" data-is-locked="${thread.isLocked ? "true" : "false"}" style="padding:0.25rem 0.55rem; font-size:0.72rem;">
                ${thread.isLocked ? "🔓 Unlock" : "🔒 Lock"}
              </button>
              <button type="button" class="mini-button" data-action="toggle-hide-thread" data-thread-id="${thread._id}" data-is-hidden="${thread.isHidden ? "true" : "false"}" style="padding:0.25rem 0.55rem; font-size:0.72rem;">
                ${thread.isHidden ? "👁 Unhide" : "👁 Hide"}
              </button>
            </div>
          ` : ""}
        </div>

        <!-- Replies Drawer / Container -->
        <div class="discussion-replies-wrapper" id="replies-wrapper-${thread._id}" style="display:none; width:100%; border-top:1px dashed rgba(255,255,255,0.08); padding-top:0.75rem;">
          <div class="discussion-replies-list" style="display:flex; flex-direction:column; gap:0.4rem;">
            ${repliesHtml}
          </div>

          <!-- Reply composer (if not locked) -->
          ${!thread.isLocked ? `
            <form class="discussion-reply-form" data-thread-id="${thread._id}" style="display:flex; gap:0.5rem; margin-top:0.75rem; align-items:flex-start;">
              <textarea name="replyContent" class="discussion-reply-input" required maxlength="5000" rows="1" placeholder="Write a reply..." style="flex:1; padding:0.55rem 0.75rem; min-height:38px; resize:vertical; font-size:0.8rem;"></textarea>
              <button type="submit" class="button button-primary mini-button" style="padding:0.55rem 0.85rem; height:38px; font-size:0.78rem;">
                Reply
              </button>
            </form>
          ` : `
            <p style="color:#f87171; font-size:0.75rem; margin:0.5rem 0 0 0;">🔒 This discussion thread has been locked by an instructor.</p>
          `}
        </div>
      </div>
    `;
  }).join("");
  } catch (renderErr) {
    console.error("Error rendering discussions:", renderErr);
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.style.display = "block";
      emptyEl.innerHTML = `<p style="color:var(--text-secondary);margin:0;">Could not display discussions at this time.</p>`;
    }
  }
}

// ─── Lesson Overview tab ──────────────────────────────────────────────────────
function renderOverviewTab(lecture) {
  const tc = qs("#overview-transcript-content");
  if (!tc) return;
  if (lecture.transcript || lecture.notes) {
    tc.textContent = lecture.transcript || lecture.notes;
  } else {
    tc.textContent = "No notes or transcript available for this lecture.";
  }
  // Reset takeaways
  const ta = qs("#ai-takeaways-content");
  if (ta) ta.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">Click "Generate Summary" to get AI-powered key takeaways for this lecture.</p>';
}

// ─── Personal Notes tab ───────────────────────────────────────────────────────
async function loadNotes(lectureId) {
  const textarea  = qs("#notes-textarea");
  const indicator = qs("#notes-save-indicator");
  if (!textarea) return;

  textarea.value = "";
  if (indicator) indicator.textContent = "";
  updateNotesCharCount();

  try {
    const res = await learningService.getNote(lectureId);
    const content = res?.data?.content ?? res?.content ?? "";
    textarea.value = content;
    updateNotesCharCount();
  } catch { /* no existing note → blank */ }
}

function updateNotesCharCount() {
  const textarea = qs("#notes-textarea");
  const counter  = qs("#notes-char-count");
  const badge    = qs("#notes-count-badge");
  if (!textarea) return;
  const len = textarea.value.length;
  if (counter) counter.textContent = `${len.toLocaleString()} / 10,000`;
  // Update tab badge
  if (badge) badge.textContent = len > 0 ? ` (${len > 999 ? "999+" : len})` : "";
}

async function saveNotes(lectureId, content) {
  const indicator = qs("#notes-save-indicator");
  if (indicator) indicator.textContent = "Saving…";
  try {
    await learningService.saveNote(lectureId, content);
    if (indicator) indicator.textContent = "Saved ✓";
    setTimeout(() => { if (indicator) indicator.textContent = ""; }, 2500);
  } catch (err) {
    if (indicator) indicator.textContent = `Error: ${errorText(err)}`;
  }
}

// ─── Bookmarks tab ────────────────────────────────────────────────────────────
async function loadBookmarks() {
  try {
    const res = await learningService.getMyBookmarks();
    bookmarksCache = res?.data?.bookmarks || res?.bookmarks || (Array.isArray(res?.data) ? res.data : []);
  } catch { bookmarksCache = []; }
}

function updateBookmarkState(lectureId) {
  isBookmarked = bookmarksCache.some(b => {
    const bLecId = b.lecture?._id || b.lecture || b.lectureId;
    return String(bLecId) === String(lectureId);
  });

  // Update both bookmark buttons
  const btnB  = qs("#btn-bookmark-toggle");
  const btnBY = qs("#btn-bookmark-yt");
  [btnB, btnBY].forEach(btn => {
    if (!btn) return;
    btn.textContent = isBookmarked ? "🔖 Bookmarked" : "🔖 Bookmark";
    btn.classList.toggle("is-bookmarked", isBookmarked);
  });
}

function renderBookmarksTab() {
  const panel = qs("#bookmarks-list-panel");
  if (!panel) return;

  // Filter to current course
  const courseBookmarks = bookmarksCache.filter(b => {
    const cId = b.course?._id || b.course || b.courseId;
    return !currentCourse?._id || !cId || String(cId) === String(currentCourse._id);
  });

  if (!courseBookmarks.length) {
    panel.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No bookmarks saved for this course yet.</p>';
    return;
  }

  panel.innerHTML = courseBookmarks.map(b => {
    const lecId    = b.lecture?._id || b.lecture || b.lectureId;
    const lecTitle = b.lecture?.title || b.lectureTitle || "Lecture";
    const modTitle = b.module?.title || b.moduleTitle || "";
    const savedAt  = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "";

    return `
      <div class="bookmark-item" data-lecture-id="${escapeHtml(lecId)}">
        <div class="bookmark-item-info">
          <span class="bookmark-item-title">${escapeHtml(lecTitle)}</span>
          ${modTitle ? `<small class="bookmark-item-meta">${escapeHtml(modTitle)}</small>` : ""}
        </div>
        <div class="bookmark-item-actions">
          ${savedAt ? `<small class="bookmark-item-date">${savedAt}</small>` : ""}
          <button class="player-ctrl-btn" data-jump-lecture="${escapeHtml(lecId)}" type="button" title="Jump to lecture">▶ Jump</button>
          <button class="player-ctrl-btn bookmark-remove-btn" data-remove-bookmark="${escapeHtml(lecId)}" type="button" title="Remove bookmark">✕</button>
        </div>
      </div>
    `;
  }).join("");

  // Jump-to-lecture handler
  panel.querySelectorAll("[data-jump-lecture]").forEach(btn => {
    btn.addEventListener("click", () => {
      const lId = btn.dataset.jumpLecture;
      jumpToLecture(lId);
    });
  });

  // Remove bookmark handler
  panel.querySelectorAll("[data-remove-bookmark]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const lId = btn.dataset.removeBookmark;
      try {
        await learningService.removeBookmark(lId);
        bookmarksCache = bookmarksCache.filter(b => {
          const bId = b.lecture?._id || b.lecture || b.lectureId;
          return String(bId) !== String(lId);
        });
        if (activeLecture?._id === lId) updateBookmarkState(lId);
        renderBookmarksTab();
        toast("Bookmark removed.");
      } catch (err) {
        toast(`Could not remove bookmark: ${errorText(err)}`, "error");
      }
    });
  });
}

function jumpToLecture(lectureId, preserveTab = false) {
  for (const mod of currentModules) {
    const lec = (mod.lectures || []).find(l => String(l._id) === String(lectureId));
    if (lec) {
      selectLecture(lec, mod.title);
      if (!preserveTab) switchTab("lesson-overview");
      toast(`Jumped to: ${lec.title} 🎬`);
      return;
    }
  }
}

// ─── AI Tutor tab & Interactive Features ──────────────────────────────────────
function formatAiText(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?:^|\n)[*•-]\s+(.+)/g, "<br/>• $1");
  html = html.replace(/\n\n+/g, "<br/><br/>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function appendChatBubble(text, role = "ai", sources = []) {
  const msgs = qs("#ai-chat-messages");
  if (!msgs) return null;
  const div = document.createElement("div");
  div.className = `ai-chat-bubble ${role === "user" ? "user-bubble" : "ai-bubble"}`;

  const contentEl = document.createElement("div");
  contentEl.className = "ai-bubble-content";
  if (role === "user") {
    contentEl.textContent = text;
  } else {
    contentEl.innerHTML = formatAiText(text);
  }
  div.appendChild(contentEl);

  if (role === "ai" && Array.isArray(sources) && sources.length > 0) {
    const srcBox = document.createElement("div");
    srcBox.className = "ai-sources-container";
    srcBox.innerHTML = `
      <span class="ai-sources-title">📚 Source Citations:</span>
      <div class="ai-sources-pills">
        ${sources.map(s => `
          <button type="button" class="ai-source-pill" data-source-lecture-id="${escapeHtml(s.lectureId)}" title="Jump to this lecture">
            📖 ${escapeHtml(s.lectureTitle || "Lecture")}
            ${s.score ? `<span class="ai-source-score">${Math.round(s.score * 100)}% match</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;

    srcBox.querySelectorAll(".ai-source-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const lId = pill.dataset.sourceLectureId;
        if (lId) jumpToLecture(lId, true);
      });
    });

    div.appendChild(srcBox);
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return { element: div, contentEl };
}

async function loadChatSessions(courseId) {
  if (!courseId) return;
  try {
    const res = await aiService.getCourseChats(courseId);
    chatSessions = res?.data?.sessions || res?.sessions || [];

    const countEl = qs("#chat-history-count");
    if (countEl) countEl.textContent = String(chatSessions.length);

    const listEl = qs("#ai-sessions-list");
    if (!listEl) return;

    if (!chatSessions.length) {
      listEl.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;padding:0.4rem;">No previous chat sessions yet.</p>';
      return;
    }

    listEl.innerHTML = chatSessions.map(s => {
      const isActive = s._id === activeChatSessionId;
      const title = s.title || "Conversation";
      const dateStr = s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleDateString() : "";
      return `
        <div class="ai-session-item${isActive ? " is-active-session" : ""}" data-session-id="${escapeHtml(s._id)}">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(title)}</span>
          <span class="ai-session-meta">${dateStr}</span>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".ai-session-item").forEach(item => {
      item.addEventListener("click", () => {
        const sId = item.dataset.sessionId;
        if (sId) openChatSession(sId);
      });
    });
  } catch {
    // Non-critical background failure
  }
}

async function openChatSession(sessionId) {
  try {
    const msgsContainer = qs("#ai-chat-messages");
    if (msgsContainer) msgsContainer.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:1rem;">Loading conversation…</p>';

    const res = await aiService.getChatSession(sessionId);
    const session = res?.data?.session || res?.session;

    if (!session) {
      toast("Could not open chat session.", "error");
      return;
    }

    activeChatSessionId = session._id;
    const label = qs("#ai-active-session-label");
    if (label) label.textContent = session.title || "Previous conversation";

    if (msgsContainer) {
      msgsContainer.innerHTML = "";
      const messages = session.messages || [];
      if (!messages.length) {
        appendChatBubble("No messages in this conversation yet. Ask a question below!", "ai");
      } else {
        messages.forEach(m => {
          appendChatBubble(m.content, m.role, m.sources || []);
        });
      }
    }

    qs("#ai-sessions-drawer")?.setAttribute("hidden", "true");
    loadChatSessions(currentCourse?._id);
    toast("Loaded previous conversation.");
  } catch (err) {
    toast(`Failed to load chat: ${errorText(err)}`, "error");
  }
}

function startNewChat() {
  activeChatSessionId = null;
  const msgsContainer = qs("#ai-chat-messages");
  if (msgsContainer) {
    msgsContainer.innerHTML = `
      <div class="ai-chat-bubble ai-bubble">
        <div class="ai-bubble-content">Hello! I'm your AI learning assistant. Ask me anything about this lecture or course!</div>
      </div>
    `;
  }
  const label = qs("#ai-active-session-label");
  if (label) label.textContent = "Ask questions about this lecture or course";
  qs("#ai-sessions-drawer")?.setAttribute("hidden", "true");
  toast("Started a new chat session.");
}

async function handleLectureSummary() {
  if (!activeLecture) {
    toast("Please select a lecture first.");
    return;
  }

  openModal({
    title: `📋 AI Summary: ${escapeHtml(activeLecture.title)}`,
    contentHtml: `
      <div id="lecture-summary-modal-body" style="min-height:160px; line-height:1.6; font-size:0.92rem;">
        <p style="color:var(--muted); padding:1rem 0;">Generating AI lecture summary with key takeaways…</p>
      </div>
    `,
    confirmText: "Done",
    onConfirm: (_, close) => close()
  });

  try {
    const res = await aiService.summarizeLecture(activeLecture._id);
    const summary = res?.data?.summary || res?.summary || "No summary available.";

    const bodyEl = document.querySelector("#lecture-summary-modal-body");
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="background:rgba(124,58,237,0.06); border:1px solid rgba(167,139,250,0.2); border-radius:0.5rem; padding:1rem; margin-bottom:1rem;">
          <h4 style="margin:0 0 0.5rem; color:#a78bfa; font-size:0.95rem;">Lecture: ${escapeHtml(activeLecture.title)}</h4>
          <div style="color:#f8fafc;">${formatAiText(summary)}</div>
        </div>
      `;
    }

    const overviewBox = qs("#ai-takeaways-content");
    if (overviewBox) {
      overviewBox.innerHTML = formatAiText(summary);
    }
  } catch (err) {
    const bodyEl = document.querySelector("#lecture-summary-modal-body");
    if (bodyEl) {
      bodyEl.innerHTML = `<p style="color:#ff9b9b;">Could not generate summary: ${escapeHtml(errorText(err))}</p>`;
    }
  }
}

async function handleStudyPlan() {
  if (!currentCourse) return;

  openModal({
    title: `📅 Adaptive Study Plan: ${escapeHtml(currentCourse.title)}`,
    contentHtml: `
      <div id="study-plan-modal-body" style="min-height:220px;">
        <p style="color:var(--muted); padding:1rem 0;">Analyzing your retention and generating adaptive study plan…</p>
      </div>
    `,
    confirmText: "Close Plan",
    onConfirm: (_, close) => close()
  });

  try {
    const res = await aiService.createStudyPlan({ courseId: currentCourse._id, days: 7 });
    const data = res?.data || res;
    const plan = data?.studyPlan || [];
    const mastery = data?.mastery || {};
    const avgScore = mastery.averageScore !== null && mastery.averageScore !== undefined ? `${mastery.averageScore}%` : "Not assessed";

    const modalBody = document.querySelector("#study-plan-modal-body");
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="study-plan-overview">
        <div class="study-plan-stat-card">
          <small style="color:var(--muted);font-size:0.75rem;">Assessed Topics</small>
          <div class="study-plan-stat-val">${mastery.assessedTopics ?? 0} / ${mastery.totalTopics ?? 0}</div>
        </div>
        <div class="study-plan-stat-card">
          <small style="color:var(--muted);font-size:0.75rem;">Average Score</small>
          <div class="study-plan-stat-val" style="color:#52d8c2;">${avgScore}</div>
        </div>
        <div class="study-plan-stat-card">
          <small style="color:var(--muted);font-size:0.75rem;">Plan Length</small>
          <div class="study-plan-stat-val">7 Days</div>
        </div>
      </div>

      <h4 style="font-size:0.95rem; margin:0 0 0.6rem; color:#f8fafc;">Day-by-Day Schedule</h4>
      <div class="study-plan-timeline">
        ${plan.map(d => `
          <div class="study-plan-day-card">
            <span class="study-plan-day-badge">Day ${d.day}</span>
            <div class="study-plan-day-content">
              <h5 class="study-plan-day-title">${escapeHtml(d.topic || "Core Material")}</h5>
              <p class="study-plan-day-act">${escapeHtml(d.activity || "Review lecture notes and practice exercises.")}</p>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    const modalBody = document.querySelector("#study-plan-modal-body");
    if (modalBody) {
      modalBody.innerHTML = `<p style="color:#ff9b9b;">Failed to create study plan: ${escapeHtml(errorText(err))}</p>`;
    }
  }
}

async function handleFlashcards() {
  if (!activeLecture) {
    toast("Please select a lecture first.");
    return;
  }

  openModal({
    title: `🗂 Module Flashcards Review`,
    contentHtml: `
      <div id="flashcard-modal-body" style="min-height:240px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
        <p style="color:var(--muted); padding:1rem 0;">Generating interactive flashcards for this module…</p>
      </div>
    `,
    confirmText: "Finish Review",
    onConfirm: (_, close) => close()
  });

  try {
    const targetModuleId =
      activeLecture.moduleId?._id ||
      activeLecture.moduleId ||
      (currentModules.find((m) => (m.lectures || []).some((l) => String(l._id) === String(activeLecture._id)))?._id);

    if (!targetModuleId) {
      toast("Could not identify the module for this lecture.", "error");
      return;
    }

    const res = await aiService.generateModuleFlashcards(targetModuleId, 10);
    const set = res?.data?.flashcardSet || res?.flashcardSet || res?.data || res;
    const cards = set.flashcards || set.cards || [];

    const bodyEl = document.querySelector("#flashcard-modal-body");
    if (!bodyEl) return;

    if (!cards.length) {
      bodyEl.innerHTML = `<p style="color:var(--muted);">No flashcards generated for this module yet. Try another module or lecture.</p>`;
      return;
    }

    let currentIndex = 0;
    let isFlipped = false;

    const renderCard = () => {
      const card = cards[currentIndex];
      bodyEl.innerHTML = `
        <div class="flashcard-wrapper" style="width:100%;">
          <div style="display:flex; justify-content:space-between; width:100%; font-size:0.8rem; color:var(--muted); margin-bottom:0.25rem;">
            <span>Card ${currentIndex + 1} of ${cards.length}</span>
            <span>Click card to flip 🔄</span>
          </div>

          <div class="flashcard-card" id="active-interactive-card">
            <span class="flashcard-label">${isFlipped ? "💡 ANSWER" : "❓ QUESTION"}</span>
            <div class="flashcard-text">${escapeHtml(isFlipped ? card.back || card.answer : card.front || card.question)}</div>
            <span class="flashcard-hint">${isFlipped ? "(Click to see question)" : "(Click to reveal answer)"}</span>
          </div>

          <div class="flashcard-controls">
            <button type="button" class="button button-secondary mini-button" id="btn-fc-prev" ${currentIndex === 0 ? "disabled" : ""}>
              ← Previous
            </button>
            <button type="button" class="button button-primary mini-button" id="btn-fc-flip">
              🔄 Flip
            </button>
            <button type="button" class="button button-secondary mini-button" id="btn-fc-next" ${currentIndex === cards.length - 1 ? "disabled" : ""}>
              Next →
            </button>
          </div>
        </div>
      `;

      const toggleFlip = () => { isFlipped = !isFlipped; renderCard(); };
      document.querySelector("#active-interactive-card")?.addEventListener("click", toggleFlip);
      document.querySelector("#btn-fc-flip")?.addEventListener("click", toggleFlip);

      document.querySelector("#btn-fc-prev")?.addEventListener("click", () => {
        if (currentIndex > 0) { currentIndex--; isFlipped = false; renderCard(); }
      });
      document.querySelector("#btn-fc-next")?.addEventListener("click", () => {
        if (currentIndex < cards.length - 1) { currentIndex++; isFlipped = false; renderCard(); }
      });
    };

    renderCard();
  } catch (err) {
    const bodyEl = document.querySelector("#flashcard-modal-body");
    if (bodyEl) {
      bodyEl.innerHTML = `<p style="color:#ff9b9b;">Could not load flashcards: ${escapeHtml(errorText(err))}</p>`;
    }
  }
}

// ─── Select lecture (main dispatch) ──────────────────────────────────────────
async function selectLecture(lecture, moduleTitle) {
  // 1. Save progress for PREVIOUS lecture before switching
  if (activeLecture && !isYouTube) {
    const vid = getVideoEl();
    if (vid) {
      savePositionToLS();
      pushProgressToBackend(activeLecture._id, Math.floor(vid.currentTime), false);
    }
  }
  stopProgressInterval();

  // 2. Update state
  activeLecture    = lecture;
  activeModuleTitle = moduleTitle || "";

  // 3. Save lastLecture to localStorage for dashboard "Resume" card
  setLastLecture(currentCourse?._id, {
    lectureId   : lecture._id,
    lectureTitle: lecture.title,
    moduleTitle : moduleTitle || "",
    watchedSeconds: getLSProgress(lecture._id)?.watchedSeconds || 0
  });

  // 4. Render video
  renderVideo(lecture);

  // 5. Lecture header
  const titleEl = qs("#player-lecture-title");
  const metaEl  = qs("#player-lecture-meta");
  if (titleEl) titleEl.textContent = lecture.title;
  if (metaEl) {
    const dur = lecture.durationSeconds ? `${formatDuration(lecture.durationSeconds)} min` : "Lesson";
    metaEl.textContent = `${moduleTitle || "Module"} • ${dur}`;
  }

  // 6. Mark-complete button state
  const btnMC = qs("#btn-mark-complete");
  const prog  = lectureProgressMap.get(lecture._id) || {};
  if (btnMC) {
    btnMC.disabled = !!prog.completed;
    btnMC.textContent = prog.completed ? "Completed ✓" : "Mark Complete ✓";
  }

  // 7. Bookmark state
  updateBookmarkState(lecture._id);

  // 8. Topbar breadcrumb + progress
  renderTopbar();

  // 9. Curriculum: highlight active
  renderCurriculum();

  // 10. Prev/Next button enable/disable
  updatePrevNextButtons();

  // Sync jump selectors
  const jumpSel1 = qs("#player-jump-select");
  const jumpSel2 = qs("#player-jump-select-top");
  if (lecture?._id) {
    if (jumpSel1) jumpSel1.value = lecture._id;
    if (jumpSel2) jumpSel2.value = lecture._id;
  }

  // 11. Load notes (async, non-blocking)
  loadNotes(lecture._id);

  // 12. Lesson overview
  renderOverviewTab(lecture);

  // 13. Re-render bookmarks tab if open
  if (activeTab === "saved-bookmarks") renderBookmarksTab();

  // 14. Update discussion lecture view and badge count for this lecture
  renderPlayerDiscussions();
}

// ─── Prev / Next navigation ───────────────────────────────────────────────────
function buildFlatLectures() {
  flatLectures = [];
  for (const mod of currentModules) {
    for (const lec of (mod.lectures || [])) {
      flatLectures.push({ lec, modTitle: mod.title });
    }
  }
}

function currentFlatIndex() {
  return flatLectures.findIndex(fl => fl.lec._id === activeLecture?._id);
}

function updatePrevNextButtons() {
  const idx    = currentFlatIndex();
  const btnP   = qs("#btn-prev-lecture");
  const btnN   = qs("#btn-next-lecture");
  const btnPC  = qs("#btn-prev-lecture-ctrl");
  const btnNC  = qs("#btn-next-lecture-ctrl");
  const hasPrev = idx > 0;
  const hasNext = idx < flatLectures.length - 1;
  [btnP, btnPC].forEach(b => { if (b) b.disabled = !hasPrev; });
  [btnN, btnNC].forEach(b => { if (b) b.disabled = !hasNext; });
}

function goToPrev() {
  const idx = currentFlatIndex();
  if (idx <= 0) return;
  const { lec, modTitle } = flatLectures[idx - 1];
  selectLecture(lec, modTitle);
}

function goToNext() {
  const idx = currentFlatIndex();
  if (idx < 0 || idx >= flatLectures.length - 1) return;
  const { lec, modTitle } = flatLectures[idx + 1];
  selectLecture(lec, modTitle);
}

// ─── Wire events ─────────────────────────────────────────────────────────────
function wireEvents(courseId) {
  // Play/pause toggle
  qs("#btn-play-pause")?.addEventListener("click", () => {
    const vid = getVideoEl();
    if (!vid) return;
    vid.paused ? vid.play() : vid.pause();
  });

  // Prev/Next (header buttons)
  qs("#btn-prev-lecture")?.addEventListener("click", goToPrev);
  qs("#btn-next-lecture")?.addEventListener("click", goToNext);
  // Prev/Next (controls bar)
  qs("#btn-prev-lecture-ctrl")?.addEventListener("click", goToPrev);
  qs("#btn-next-lecture-ctrl")?.addEventListener("click", goToNext);

  // Quick jump directly to any lecture across the course
  const onJumpChange = (e) => {
    const targetId = e.target.value;
    if (!targetId) return;
    const target = flatLectures.find(fl => String(fl.lec._id) === String(targetId));
    if (target) {
      selectLecture(target.lec, target.modTitle);
    }
  };
  qs("#player-jump-select")?.addEventListener("change", onJumpChange);
  qs("#player-jump-select-top")?.addEventListener("change", onJumpChange);

  // Playback speed
  qs("#player-speed-select")?.addEventListener("change", e => {
    const vid = getVideoEl();
    const val = parseFloat(e.target.value) || 1;
    if (vid) vid.playbackRate = val;
    if (activeLecture) {
      const local = getLSProgress(activeLecture._id) || {};
      setLSProgress(activeLecture._id, { ...local, speed: val });
    }
  });

  // Bookmark toggle (controls bar)
  const doBookmarkToggle = async () => {
    if (!activeLecture) return;
    const lecId = activeLecture._id;
    try {
      if (isBookmarked) {
        await learningService.removeBookmark(lecId);
        bookmarksCache = bookmarksCache.filter(b => {
          const bId = b.lecture?._id || b.lecture || b.lectureId;
          return String(bId) !== String(lecId);
        });
        toast("Bookmark removed.");
      } else {
        const res = await learningService.addBookmark(lecId);
        const newBm = res?.data?.bookmark || res?.bookmark || { lecture: { _id: lecId, title: activeLecture.title }, course: currentCourse?._id, createdAt: new Date().toISOString() };
        bookmarksCache.push(newBm);
        toast("Lecture bookmarked! 🔖");
      }
      updateBookmarkState(lecId);
      if (activeTab === "saved-bookmarks") renderBookmarksTab();
    } catch (err) {
      toast(`Bookmark error: ${errorText(err)}`, "error");
    }
  };
  qs("#btn-bookmark-toggle")?.addEventListener("click", doBookmarkToggle);
  qs("#btn-bookmark-yt")?.addEventListener("click", doBookmarkToggle);

  // Mark complete button
  qs("#btn-mark-complete")?.addEventListener("click", async () => {
    if (!activeLecture) return;
    const vid = getVideoEl();
    const watched = vid ? Math.floor(vid.currentTime) : 0;
    await handleLectureComplete(activeLecture._id, watched);
  });

  // Tab switching
  container.querySelectorAll(".player-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // AI Tutor shortcut buttons
  const openAiTab = () => switchTab("ai-tutor");
  qs("#btn-ai-tutor-topbar")?.addEventListener("click", openAiTab);
  qs("#btn-open-ai-sidebar")?.addEventListener("click", openAiTab);

  // Claim or view certificate
  qs("#btn-player-cert")?.addEventListener("click", async () => {
    try {
      const certRes = await certificateService.getMyCertificates();
      const list = certRes?.data?.certificates || certRes?.certificates || [];
      const found = list.find((c) => String(c.courseId?._id || c.courseId) === String(courseId));

      if (found) {
        openCertificateModal(found);
      } else {
        const issueRes = await certificateService.issueCertificate(courseId);
        const newCert = issueRes?.data?.certificate || issueRes?.certificate || issueRes;
        toast("Congratulations! Your Certificate of Completion has been issued! 🎓");
        openCertificateModal(newCert);
      }
    } catch (err) {
      toast(`Could not load certificate: ${errorText(err)}`, "error");
    }
  });

  // Personal notes: auto-save debounce
  const textarea = qs("#notes-textarea");
  textarea?.addEventListener("input", () => {
    updateNotesCharCount();
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => {
      if (activeLecture) saveNotes(activeLecture._id, textarea.value);
    }, 1500);
  });

  // Notes manual save
  qs("#btn-save-notes")?.addEventListener("click", () => {
    if (!activeLecture || !textarea) return;
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    saveNotes(activeLecture._id, textarea.value);
  });

  // AI Tutor Quick Actions
  qs("#btn-lecture-summary-quick")?.addEventListener("click", handleLectureSummary);
  qs("#btn-study-planner")?.addEventListener("click", handleStudyPlan);
  qs("#btn-flashcards")?.addEventListener("click", handleFlashcards);

  // Chat History Drawer Toggle & Close & New Chat
  qs("#btn-toggle-chat-history")?.addEventListener("click", () => {
    const drawer = qs("#ai-sessions-drawer");
    if (!drawer) return;
    const isHidden = drawer.hidden;
    drawer.hidden = !isHidden;
    if (isHidden) loadChatSessions(courseId);
  });
  qs("#btn-close-sessions")?.addEventListener("click", () => {
    const drawer = qs("#ai-sessions-drawer");
    if (drawer) drawer.hidden = true;
  });
  qs("#btn-new-chat-session")?.addEventListener("click", startNewChat);

  // AI Tutor chat form
  qs("#ai-chat-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const input   = qs("#ai-chat-form input[name='message']");
    const userMsg = input?.value?.trim();
    if (!userMsg) return;

    appendChatBubble(userMsg, "user");
    if (input) input.value = "";

    const loadingObj = appendChatBubble("Thinking…", "ai");

    try {
      const res = await aiService.sendChatMessage(courseId, userMsg, activeChatSessionId);
      const reply = res?.data?.answer || res?.data?.reply || res?.answer || res?.reply || "I'm here to help!";
      const sources = res?.data?.sources || res?.sources || [];

      if (res?.sessionId || res?.data?.sessionId) {
        activeChatSessionId = res?.sessionId || res?.data?.sessionId;
      }

      if (loadingObj?.element) {
        loadingObj.element.remove();
      }
      appendChatBubble(reply, "ai", sources);

      // Keep history list refreshed
      loadChatSessions(courseId);
    } catch {
      if (loadingObj?.contentEl) {
        loadingObj.contentEl.textContent = "I'm having trouble connecting right now. Please try again soon.";
      }
    }
  });

  // AI Key Takeaways
  qs("#btn-refresh-takeaways")?.addEventListener("click", handleLectureSummary);

  // Initial load of chat sessions
  loadChatSessions(courseId);

  // Announcements refresh
  qs("#btn-refresh-player-announcements")?.addEventListener("click", () => {
    loadCourseAnnouncements(courseId);
  });

  // Discussions composer toggle & cancel
  qs("#btn-toggle-new-thread")?.addEventListener("click", () => {
    const p = qs("#new-thread-panel");
    if (!p) return;
    p.hidden = !p.hidden;
    if (!p.hidden) {
      qs("#thread-title-input")?.focus();
    }
  });

  const closePlayerNewThread = () => {
    const p = qs("#new-thread-panel");
    if (p) p.hidden = true;
  };
  qs("#btn-cancel-new-thread")?.addEventListener("click", closePlayerNewThread);
  qs("#btn-cancel-new-thread-2")?.addEventListener("click", closePlayerNewThread);

  // Discussions new thread submit
  qs("#new-thread-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = qs("#thread-title-input");
    const contentInput = qs("#thread-content-input");
    const submitBtn = qs("#btn-submit-thread");

    const title = titleInput?.value?.trim();
    const content = contentInput?.value?.trim();
    if (!title || title.length < 3) {
      toast("Question title must be at least 3 characters", "error");
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
        courseId,
        lectureId: activeLecture ? String(activeLecture._id) : null,
        lectureTitle: activeLecture ? (activeLecture.title || "") : "",
        title,
        content
      });

      toast("Question posted for this lecture! 💬", "success");
      if (titleInput) titleInput.value = "";
      if (contentInput) contentInput.value = "";
      closePlayerNewThread();
      await loadCourseDiscussions(courseId);
    } catch (err) {
      toast(`Failed to post question: ${errorText(err)}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Discussions refresh
  qs("#btn-refresh-discussions")?.addEventListener("click", () => {
    loadCourseDiscussions(courseId);
  });

  // Delegated thread actions in #player-discussions-list
  qs("#player-discussions-list")?.addEventListener("click", async (e) => {
    // Toggle replies drawer
    const toggleRepliesBtn = e.target.closest('[data-action="toggle-replies"]');
    if (toggleRepliesBtn) {
      const threadId = toggleRepliesBtn.dataset.threadId;
      const drawer = qs(`#replies-wrapper-${threadId}`);
      if (drawer) {
        drawer.style.display = drawer.style.display === "none" ? "block" : "none";
      }
      return;
    }

    // Report thread
    const reportThreadBtn = e.target.closest('[data-action="report-thread"]');
    if (reportThreadBtn) {
      const threadId = reportThreadBtn.dataset.threadId;
      openReportModal({
        targetType: "thread",
        onSubmit: async (reason) => {
          try {
            await discussionService.reportThread(threadId, reason);
            toast("Thread reported to moderators. Thank you.", "info");
            await loadCourseDiscussions(courseId);
          } catch (err) {
            toast(`Could not report thread: ${errorText(err)}`, "error");
          }
        }
      });
      return;
    }

    // Report reply post
    const reportPostBtn = e.target.closest('[data-action="report-post"]');
    if (reportPostBtn) {
      const threadId = reportPostBtn.dataset.threadId;
      const postId = reportPostBtn.dataset.postId;
      openReportModal({
        targetType: "comment",
        onSubmit: async (reason) => {
          try {
            await discussionService.reportPost(threadId, postId, reason);
            toast("Comment reported to moderators. Thank you.", "info");
            await loadCourseDiscussions(courseId);
          } catch (err) {
            toast(`Could not report comment: ${errorText(err)}`, "error");
          }
        }
      });
      return;
    }

    // Lock/Unlock thread (Instructor/Admin)
    const lockBtn = e.target.closest('[data-action="toggle-lock-thread"]');
    if (lockBtn) {
      const threadId = lockBtn.dataset.threadId;
      const isLocked = lockBtn.dataset.isLocked === "true";
      try {
        await discussionService.moderateDiscussion(threadId, {
          action: isLocked ? "unlock" : "lock",
          target: "thread"
        });
        toast(`Thread ${isLocked ? "unlocked" : "locked"}.`);
        await loadCourseDiscussions(courseId);
      } catch (err) {
        toast(`Moderation error: ${errorText(err)}`, "error");
      }
      return;
    }

    // Hide/Unhide thread (Instructor/Admin)
    const hideThreadBtn = e.target.closest('[data-action="toggle-hide-thread"]');
    if (hideThreadBtn) {
      const threadId = hideThreadBtn.dataset.threadId;
      const isHidden = hideThreadBtn.dataset.isHidden === "true";
      try {
        await discussionService.moderateDiscussion(threadId, {
          action: isHidden ? "unhide" : "hide",
          target: "thread"
        });
        toast(`Thread ${isHidden ? "restored" : "hidden"}.`);
        await loadCourseDiscussions(courseId);
      } catch (err) {
        toast(`Moderation error: ${errorText(err)}`, "error");
      }
      return;
    }

    // Hide/Unhide post (Instructor/Admin)
    const hidePostBtn = e.target.closest('[data-action="toggle-hide-post"]');
    if (hidePostBtn) {
      const threadId = hidePostBtn.dataset.threadId;
      const postId = hidePostBtn.dataset.postId;
      const isHidden = hidePostBtn.dataset.isHidden === "true";
      try {
        await discussionService.moderateDiscussion(threadId, {
          action: isHidden ? "unhide" : "hide",
          target: "post",
          postId
        });
        toast(`Reply ${isHidden ? "restored" : "hidden"}.`);
        await loadCourseDiscussions(courseId);
      } catch (err) {
        toast(`Moderation error: ${errorText(err)}`, "error");
      }
      return;
    }
  });

  // Reply form submission
  qs("#player-discussions-list")?.addEventListener("submit", async (e) => {
    const form = e.target.closest(".discussion-reply-form");
    if (!form) return;
    e.preventDefault();
    const threadId = form.dataset.threadId;
    const input = form.querySelector("textarea[name='replyContent']");
    const content = input?.value?.trim();
    if (!content) return;

    const btn = form.querySelector("button[type='submit']");
    if (btn) btn.disabled = true;

    try {
      await discussionService.replyToThread(threadId, { content });
      toast("Reply posted! 💬", "success");
      if (input) input.value = "";
      await loadCourseDiscussions(courseId);
      // Ensure drawer stays open
      const drawer = qs(`#replies-wrapper-${threadId}`);
      if (drawer) drawer.style.display = "block";
    } catch (err) {
      toast(`Failed to post reply: ${errorText(err)}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Page unload: save position
  window.addEventListener("beforeunload", () => {
    if (activeLecture && !isYouTube) savePositionToLS();
  });

  // Hash change: clean up if leaving player
  window.addEventListener("hashchange", () => {
    if (!window.location.hash.startsWith("#/student/course-player")) {
      stopProgressInterval();
    }
  });
}

// ─── Mount ────────────────────────────────────────────────────────────────────
export async function mountCoursePlayer(cont) {
  container = cont;

  // Reset state
  currentCourse      = null;
  currentModules     = [];
  activeLecture      = null;
  activeModuleTitle  = "";
  flatLectures       = [];
  lectureProgressMap = new Map();
  bookmarksCache     = [];
  isBookmarked       = false;
  notesSaveTimer     = null;
  activeTab          = "lesson-overview";
  isYouTube          = false;
  enrollment         = null;
  activeChatSessionId = null;
  chatSessions       = [];
  courseAnnouncements = [];
  courseDiscussions  = [];
  discussionsFilter  = "all";
  stopProgressInterval();

  // Parse courseId from hash: #/student/course-player?courseId=…
  const hashParts = window.location.hash.split("?");
  const params    = new URLSearchParams(hashParts[1] || "");
  const courseId  = params.get("courseId");

  if (!courseId) {
    toast("No course specified.", "error");
    window.location.hash = "#/student/dashboard";
    return;
  }

  // Show loading state in curriculum
  const currTree = qs("#player-curriculum-tree");
  if (currTree) currTree.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:1rem 0;">Loading…</p>';

  try {
    // Load course data + enrollment + bookmarks in parallel
    const [courseRes, modRes] = await Promise.all([
      courseService.getCourseById(courseId),
      courseService.listModules(courseId)
    ]);

    currentCourse  = courseRes?.data?.course || courseRes?.course || null;
    currentModules = modRes?.data?.modules   || modRes?.modules   || [];

    // Load enrollment + bookmarks + lecture progress (non-blocking failures OK)
    const [enrollRes, bmsRes, progressRes] = await Promise.allSettled([
      enrollmentService.getMyEnrollmentForCourse(courseId),
      learningService.getMyBookmarks(),
      enrollmentService.getCourseProgress(courseId)
    ]);

    if (enrollRes.status === "fulfilled") enrollment = enrollRes.value;
    if (bmsRes.status === "fulfilled") {
      const r = bmsRes.value;
      bookmarksCache = r?.data?.bookmarks || r?.bookmarks || (Array.isArray(r?.data) ? r.data : []);
    }

    // Build lectureProgressMap from backend LectureProgress records
    // supplemented by localStorage for watchedSeconds (resume position)
    const backendProgress = progressRes.status === "fulfilled"
      ? (progressRes.value?.data?.lectureProgress || [])
      : [];

    for (const mod of currentModules) {
      for (const lec of (mod.lectures || [])) {
        const record    = backendProgress.find(r => String(r.lectureId) === String(lec._id));
        const lsData    = getLSProgress(lec._id) || {};
        lectureProgressMap.set(lec._id, {
          // localStorage watchedSeconds wins for resume (it's more granular, updated every 5s)
          // backend completed flag is the source of truth for completion state
          watchedSeconds: lsData.watchedSeconds ?? record?.watchedSeconds ?? 0,
          completed     : record?.completed ?? false,
        });
      }
    }

    // Build flat list for prev/next
    buildFlatLectures();

    // Wire UI events
    wireEvents(courseId);

    // Render topbar + curriculum
    renderTopbar();
    renderCurriculum();

    // Determine which lecture to start on: resume from localStorage or first
    const lastData  = (() => {
      try { return JSON.parse(localStorage.getItem(`vertex:lastLecture:${courseId}`) || "null"); } catch { return null; }
    })();

    let startLecture = null;
    let startModTitle = "";

    if (lastData?.lectureId) {
      for (const mod of currentModules) {
        const found = (mod.lectures || []).find(l => String(l._id) === String(lastData.lectureId));
        if (found) { startLecture = found; startModTitle = mod.title; break; }
      }
    }

    if (!startLecture && currentModules[0]?.lectures?.[0]) {
      startLecture  = currentModules[0].lectures[0];
      startModTitle = currentModules[0].title;
    }

    if (startLecture) {
      await selectLecture(startLecture, startModTitle);
    }

    // Load course announcements & discussions in parallel
    loadCourseAnnouncements(courseId);
    await loadCourseDiscussions(courseId);

    // If URL contains tab param (e.g. from notification click: &tab=announcements)
    const initialTab = params.get("tab");
    if (initialTab) {
      switchTab(initialTab);
    }

  } catch (err) {
    toast(`Failed to load course: ${errorText(err)}`, "error");
    if (currTree) currTree.innerHTML = `<p style="color:var(--error);font-size:0.85rem;">Error loading curriculum.</p>`;
  }
}
