import { escapeHtml } from "../../utils/dom.js";

export function renderModuleItem(module) {
  const lectureCount = Array.isArray(module.lectures) ? module.lectures.length : 0;
  return `
    <div class="created-item module-row" data-module-id="${escapeHtml(module._id)}">
      <div class="module-info-left">
        <span class="module-idx-badge">Module ${module.orderIndex || 1}</span>
        <strong class="module-title-text">${escapeHtml(module.title)}</strong>
        <small class="module-lecture-count">${lectureCount} ${lectureCount === 1 ? "lecture" : "lectures"}</small>
      </div>
      <div class="module-actions">
        <button class="mini-button button-secondary" type="button" data-rename-module="${escapeHtml(module._id)}" data-title="${escapeHtml(module.title)}" data-order="${module.orderIndex || 1}">
          ✏️ Rename
        </button>
        <button class="mini-button button-danger" type="button" data-delete-module="${escapeHtml(module._id)}" title="Delete module and its lectures">
          ✕
        </button>
      </div>
    </div>
  `;
}

export function renderLectureItem(lecture) {
  const durationText = lecture.durationSeconds ? `${Math.round(lecture.durationSeconds / 60)} min` : "";
  const hasVideo = Boolean(lecture.videoUrl && lecture.videoUrl.trim());
  const hasTranscript = Boolean(lecture.transcript && lecture.transcript.trim());

  return `
    <div class="created-item lecture-row" data-lecture-id="${escapeHtml(lecture._id)}">
      <div class="lecture-header-row">
        <span>Lecture ${lecture.orderIndex || 1}</span>
        <strong>${escapeHtml(lecture.title)}</strong>
        <small>${escapeHtml(lecture.moduleTitle || "Module")}${durationText ? ` • ${durationText}` : ""}</small>
      </div>
      <div class="lecture-meta-badges">
        ${
          hasVideo
            ? `<a href="${escapeHtml(lecture.videoUrl)}" target="_blank" rel="noopener noreferrer" class="lecture-pill video-pill" title="${escapeHtml(lecture.videoUrl)}">📹 Video Link ↗</a>`
            : `<span class="lecture-pill muted-pill">📄 No video</span>`
        }
        ${
          hasTranscript
            ? `<button type="button" class="lecture-pill transcript-pill" data-toggle-transcript="${escapeHtml(lecture._id)}">📝 Transcript (${lecture.transcript.length} chars) ▾</button>`
            : `<span class="lecture-pill muted-pill">No transcript</span>`
        }
        <div class="lecture-actions-right">
          <button class="mini-button button-secondary" type="button" data-edit-lecture="${escapeHtml(lecture._id)}">
            ✏️ Edit
          </button>
          <button class="mini-button button-danger" type="button" data-delete-lecture="${escapeHtml(lecture._id)}" title="Delete lecture">
            ✕
          </button>
        </div>
      </div>
      ${
        hasTranscript
          ? `
        <div class="transcript-preview-panel" id="transcript-preview-${escapeHtml(lecture._id)}" hidden>
          <div class="transcript-preview-header">
            <strong>Full Transcript Text</strong>
            <button type="button" class="mini-button button-subtle" data-toggle-transcript="${escapeHtml(lecture._id)}">Close ✕</button>
          </div>
          <p class="transcript-preview-body">${escapeHtml(lecture.transcript)}</p>
        </div>
      `
          : ""
      }
    </div>
  `;
}
