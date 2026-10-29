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
import { escapeHtml }       from "../../utils/dom.js";
import { toast }            from "../../components/common/toast.js";
import { errorText }        from "../../utils/validation.js";
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

  // sidebar mirror
  const sf  = qs("#sidebar-progress-fill");
  const st  = qs("#sidebar-progress-text");
  if (sf) sf.style.width = `${percent}%`;
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

  tree.innerHTML = currentModules.map((mod, modIdx) => {
    const lectures = mod.lectures || [];
    const modCompleted = lectures.filter(l => lectureProgressMap.get(l._id)?.completed).length;
    const modTotal     = lectures.length;

    const lecturesHtml = lectures.map((lec, lecIdx) => {
      const prog      = lectureProgressMap.get(lec._id) || {};
      const completed = !!prog.completed;
      const isActive  = activeLecture?._id === lec._id;
      const dur       = lec.durationSeconds ? formatDuration(lec.durationSeconds) : "";

      const circleInner = completed
        ? `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="10" cy="10" r="9" stroke="#52d8c2" stroke-width="1.5" fill="rgba(82,216,194,0.12)"/>
             <path d="M6 10.5l2.5 2.5 5-5" stroke="#52d8c2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`
        : `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="10" cy="10" r="9" stroke="var(--muted)" stroke-width="1.5" fill="none"/>
           </svg>`;

      return `
        <div
          class="curriculum-lecture-item${isActive ? " is-active-lecture" : ""}${completed ? " is-completed" : ""}"
          data-lecture-id="${lec._id}"
          data-mod-idx="${modIdx}"
          data-lec-idx="${lecIdx}"
          role="button"
          tabindex="0"
          aria-label="${escapeHtml(lec.title)}${completed ? " (completed)" : ""}"
          title="${escapeHtml(lec.title)}"
        >
          <span class="lecture-completion-circle">${circleInner}</span>
          <span class="lecture-item-title">${lecIdx + 1}. ${escapeHtml(lec.title)}</span>
          ${dur ? `<span class="lecture-item-dur">${dur}</span>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="curriculum-module-group" id="mod-group-${modIdx}">
        <button
          class="curriculum-module-header"
          type="button"
          aria-expanded="true"
          data-mod-idx="${modIdx}"
          title="Toggle module"
        >
          <span class="curriculum-module-title">
            <span class="curriculum-module-num">Module ${mod.orderIndex ?? modIdx + 1}</span>
            ${escapeHtml(mod.title)}
          </span>
          <span class="curriculum-module-meta">${modCompleted}/${modTotal}</span>
          <span class="curriculum-module-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="curriculum-module-body" id="mod-body-${modIdx}">
          ${lecturesHtml || '<p style="color:var(--muted);font-size:0.83rem;padding:0.5rem;">No lectures yet.</p>'}
        </div>
      </div>
    `;
  }).join("");

  // Collapse/expand module headers
  tree.querySelectorAll(".curriculum-module-header").forEach(header => {
    header.addEventListener("click", () => {
      const idx  = header.dataset.modIdx;
      const body = qs(`#mod-body-${idx}`);
      const expanded = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!expanded));
      header.querySelector(".curriculum-module-chevron").textContent = expanded ? "▸" : "▾";
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

function jumpToLecture(lectureId) {
  for (const mod of currentModules) {
    const lec = (mod.lectures || []).find(l => String(l._id) === String(lectureId));
    if (lec) {
      selectLecture(lec, mod.title);
      // Switch to lesson overview
      switchTab("lesson-overview");
      return;
    }
  }
}

// ─── AI Tutor tab ─────────────────────────────────────────────────────────────
function appendChatBubble(text, role = "ai") {
  const msgs = qs("#ai-chat-messages");
  if (!msgs) return null;
  const div = document.createElement("div");
  div.className = `ai-chat-bubble ${role === "user" ? "user-bubble" : "ai-bubble"}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
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

  // 11. Load notes (async, non-blocking)
  loadNotes(lecture._id);

  // 12. Lesson overview
  renderOverviewTab(lecture);

  // 13. Re-render bookmarks tab if open
  if (activeTab === "saved-bookmarks") renderBookmarksTab();
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

  // AI Tutor chat form
  qs("#ai-chat-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const input   = qs("#ai-chat-form input[name='message']");
    const userMsg = input?.value?.trim();
    if (!userMsg) return;

    appendChatBubble(userMsg, "user");
    if (input) input.value = "";

    const loadingBubble = appendChatBubble("Thinking…", "ai");

    try {
      const res   = await aiService.sendChatMessage(courseId, userMsg);
      const reply = res?.data?.reply || res?.data?.message || "I'm here to help!";
      if (loadingBubble) loadingBubble.textContent = reply;
    } catch {
      if (loadingBubble) loadingBubble.textContent = "I'm having trouble connecting right now. Please try again soon.";
    }
  });

  // AI Key Takeaways
  qs("#btn-refresh-takeaways")?.addEventListener("click", async () => {
    if (!activeLecture) return;
    const box = qs("#ai-takeaways-content");
    if (box) box.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">Generating summary…</p>';
    try {
      const res     = await aiService.summarizeLecture(activeLecture._id);
      const summary = res?.data?.summary || res?.summary || "No summary available.";
      if (box) {
        box.innerHTML = summary
          .split("\n")
          .filter(l => l.trim())
          .map(l => `<p style="margin:0.4rem 0;font-size:0.9rem;line-height:1.55;">${escapeHtml(l)}</p>`)
          .join("");
      }
    } catch (err) {
      if (box) box.innerHTML = `<p style="color:var(--error);font-size:0.9rem;">Could not generate summary: ${escapeHtml(errorText(err))}</p>`;
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

  } catch (err) {
    toast(`Failed to load course: ${errorText(err)}`, "error");
    if (currTree) currTree.innerHTML = `<p style="color:var(--error);font-size:0.85rem;">Error loading curriculum.</p>`;
  }
}
