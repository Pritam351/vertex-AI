import { escapeHtml } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";
import { toast } from "./toast.js";
import { assignmentService } from "../../services/assignmentService.js";
import { errorText } from "../../utils/validation.js";

const ALLOWED_EXTS = [
  ".pdf", ".zip", ".rar", ".7z", ".tar", ".gz",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".cs",
  ".html", ".css", ".json", ".txt", ".md", ".sql", ".php", ".rb", ".go", ".rs", ".swift", ".kt"
];

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function renderRubricHtml(rubric) {
  if (!rubric) {
    return `<p style="margin:0; color:var(--muted); font-size:0.85rem;">Standard 100-point rubric: completeness, code quality, and functional accuracy.</p>`;
  }
  if (typeof rubric === "string") {
    return `<div style="font-size:0.875rem; color:#cbd5e1; white-space:pre-wrap;">${escapeHtml(rubric)}</div>`;
  }
  if (typeof rubric === "object") {
    const entries = Object.entries(rubric);
    if (entries.length === 0) {
      return `<p style="margin:0; color:var(--muted); font-size:0.85rem;">Standard 100-point rubric: completeness, code quality, and functional accuracy.</p>`;
    }
    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.6rem;">
        ${entries
          .map(
            ([key, val]) => `
          <div style="background:#0c1322; border:1px solid #27314b; border-radius:6px; padding:0.6rem 0.8rem;">
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--violet-light); font-weight:600;">${escapeHtml(
              key
            )}</div>
            <div style="font-size:0.875rem; font-weight:700; color:#f8fafc; margin-top:0.2rem; font-family:'DM Mono',monospace;">${escapeHtml(
              String(val)
            )}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }
  return `<p style="margin:0; color:var(--muted); font-size:0.85rem;">Standard project rubric.</p>`;
}

export function openAssignmentModal({ assignment, onSubmitted }) {
  const existing = document.querySelector("#assignment-detail-modal");
  if (existing) existing.remove();

  const course = assignment.course || assignment.courseId || {};
  const courseTitle = course.title || "Enrolled Course";
  const isPastDeadline = assignment.dueDate && new Date(assignment.dueDate) <= new Date();
  const deadlineText = assignment.dueDate ? formatDate(assignment.dueDate) : "No deadline specified";

  const prevSub = assignment.submission || null;
  const isGraded = prevSub && prevSub.grade !== null && prevSub.grade !== undefined;

  const backdrop = document.createElement("div");
  backdrop.id = "assignment-detail-modal";
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-assign-title" style="max-width:680px; width:min(680px, 94vw); max-height:90vh; display:flex; flex-direction:column; background:#11192d; border:1px solid #27314b; border-radius:14px; box-shadow:0 25px 60px rgba(0,0,0,0.65); overflow:hidden;">
      
      <!-- Modal Header -->
      <div class="modal-header" style="padding:1.25rem 1.5rem; border-bottom:1px solid #27314b; display:flex; justify-content:space-between; align-items:flex-start; background:#0f172a;">
        <div>
          <span style="display:inline-block; font-size:0.75rem; font-family:'DM Mono',monospace; padding:0.2rem 0.55rem; background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); border-radius:999px; margin-bottom:0.35rem;">
            📚 ${escapeHtml(courseTitle)}
          </span>
          <h3 id="modal-assign-title" style="margin:0; font-size:1.25rem; font-weight:700; color:#f8fafc; line-height:1.3;">
            ${escapeHtml(assignment.title || "Course Assignment")}
          </h3>
        </div>
        <button type="button" class="icon-button modal-close" aria-label="Close modal" style="background:transparent; border:none; color:var(--muted); font-size:1.2rem; cursor:pointer; padding:0.3rem 0.5rem;">✕</button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="modal-body" style="padding:1.5rem; overflow-y:auto; display:flex; flex-direction:column; gap:1.35rem;">
        
        <!-- Deadline Notice -->
        <div style="display:flex; align-items:center; gap:0.6rem; padding:0.75rem 1rem; border-radius:8px; background:${
          isPastDeadline ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)"
        }; border:1px solid ${
          isPastDeadline ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"
        }; color:${isPastDeadline ? "#fca5a5" : "#fcd34d"}; font-size:0.875rem;">
          <span style="font-size:1.1rem;">${isPastDeadline ? "⚠️" : "📅"}</span>
          <div>
            <strong style="font-family:'DM Mono',monospace;">Deadline: </strong>
            <span>${escapeHtml(deadlineText)}</span>
            ${isPastDeadline ? '<span style="margin-left:0.4rem; font-weight:700; color:#f87171;">(Deadline passed)</span>' : ""}
          </div>
        </div>

        <!-- Details & Instructions -->
        <div>
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); margin-bottom:0.45rem;">
            Assignment Details &amp; Instructions
          </div>
          <div style="background:#0c1322; border:1px solid #27314b; border-radius:8px; padding:1rem; font-size:0.875rem; line-height:1.6; color:#e2e8f0; white-space:pre-wrap; max-height:200px; overflow-y:auto;">${escapeHtml(
            assignment.instructions || "Follow the course lesson guidance to complete this assignment."
          )}</div>
        </div>

        <!-- Rubric Section -->
        <div>
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); margin-bottom:0.45rem;">
            Grading Rubric &amp; Criteria
          </div>
          <div style="background:#131c31; border:1px solid #27314b; border-radius:8px; padding:0.85rem;">
            ${renderRubricHtml(assignment.rubric)}
          </div>
        </div>

        <!-- Previous Submission (if any) -->
        ${
          prevSub
            ? `
          <div style="padding:0.9rem 1rem; border-radius:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#a7f3d0; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <strong style="color:#6ee7b7;">✓ Your Current Submission:</strong>
                <span style="font-family:'DM Mono',monospace; margin-left:0.35rem;">Submitted on ${formatDate(
                  prevSub.submittedAt || prevSub.createdAt
                )}</span>
              </div>
              ${
                prevSub.fileUrl
                  ? `<a href="${escapeHtml(
                      prevSub.fileUrl
                    )}" target="_blank" rel="noopener noreferrer" style="color:#6ee7b7; text-decoration:underline; font-weight:600;">📎 View Work ↗</a>`
                  : ""
              }
            </div>
            ${
              isGraded
                ? `<div style="margin-top:0.45rem; padding-top:0.45rem; border-top:1px dashed rgba(16,185,129,0.25);">
                    <span style="color:#34d399; font-weight:700;">Grade: ${prevSub.grade}/100</span>
                    ${prevSub.feedback ? `<span style="color:#e2e8f0; margin-left:0.5rem;">— “${escapeHtml(prevSub.feedback)}”</span>` : ""}
                  </div>`
                : `<div style="margin-top:0.35rem; color:#94a3b8; font-size:0.8rem;">Status: Pending instructor review. You can re-upload below before the deadline.</div>`
            }
          </div>
        `
            : ""
        }

        <!-- Submission Form Area -->
        ${
          isPastDeadline
            ? `<div style="padding:1rem; border-radius:8px; background:#1e1a22; border:1px solid #4a2828; color:#fca5a5; text-align:center; font-size:0.875rem;">
                Submissions are closed because the assignment deadline has passed.
              </div>`
            : `
          <form id="modal-submit-form" style="border-top:1px solid #27314b; padding-top:1.25rem; display:flex; flex-direction:column; gap:1rem;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); margin-bottom:0.35rem;">
                Upload Solution File
              </div>
              <p style="margin:0 0 0.65rem 0; font-size:0.8rem; color:#94a3b8;">
                Accepted formats: <strong>PDF (.pdf)</strong>, <strong>ZIP archive (.zip)</strong>, or <strong>code files (.js, .py, .java, .cpp, .html, .css, .json, .txt)</strong>. Max size: 50MB.
              </p>

              <!-- Drag and Drop Zone -->
              <div id="file-dropzone" style="border:2px dashed #3b4566; border-radius:10px; padding:1.4rem 1rem; text-align:center; background:#0c1322; cursor:pointer; position:relative; transition:all 0.2s;">
                <input type="file" id="modal-file-input" accept=".pdf,.zip,.rar,.7z,.tar,.gz,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.html,.css,.json,.txt,.md,.sql" style="position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; z-index:2;" />
                
                <div id="dropzone-idle">
                  <div style="font-size:2rem; margin-bottom:0.35rem;">📁</div>
                  <div style="font-size:0.9rem; font-weight:600; color:#f8fafc;">Click to select file or drag &amp; drop here</div>
                  <div style="font-size:0.75rem; color:var(--muted); margin-top:0.25rem;">PDF, ZIP, or Code Files</div>
                </div>

                <div id="dropzone-selected" style="display:none; align-items:center; justify-content:center; gap:0.6rem; color:#6ee7b7; font-size:0.9rem;">
                  <span style="font-size:1.6rem;">📄</span>
                  <div style="text-align:left;">
                    <div id="selected-filename" style="font-weight:600; color:#f8fafc; word-break:break-all;"></div>
                    <div id="selected-filesize" style="font-size:0.75rem; color:#94a3b8; font-family:'DM Mono',monospace;"></div>
                  </div>
                  <button type="button" id="btn-clear-file" style="background:transparent; border:none; color:#f87171; cursor:pointer; font-size:1.2rem; padding:0 0.5rem; margin-left:0.5rem; z-index:3;" title="Remove selected file">✕</button>
                </div>
              </div>
            </div>

            <!-- Alternative Project URL Input -->
            <div>
              <label for="modal-url-input" style="display:block; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); margin-bottom:0.35rem;">
                Or Project Repository / Live URL (Optional if file is uploaded)
              </label>
              <input type="url" id="modal-url-input" placeholder="https://github.com/your-username/assignment-repo" class="assignment-submit-input" style="background:#0c1322; border:1px solid #27314b;" />
            </div>

            <!-- Error message container -->
            <div id="modal-submit-error" style="display:none; padding:0.6rem 0.85rem; border-radius:6px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.85rem;"></div>

            <!-- Modal Action Buttons -->
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:0.5rem;">
              <button type="button" class="button button-outline modal-cancel" style="padding:0.6rem 1.25rem; font-size:0.875rem; cursor:pointer;">Cancel</button>
              <button type="submit" id="modal-submit-btn" class="button button-primary" style="padding:0.6rem 1.5rem; font-size:0.875rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem;">
                <span>🚀</span>
                <span id="modal-submit-btn-text">${prevSub ? "Update Submission" : "Submit Assignment"}</span>
              </button>
            </div>
          </form>
        `
        }
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.classList.add("modal-closing");
    setTimeout(() => backdrop.remove(), 200);
  };

  backdrop.querySelector(".modal-close")?.addEventListener("click", close);
  backdrop.querySelector(".modal-cancel")?.addEventListener("click", close);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKeyDown);
    }
  };
  document.addEventListener("keydown", onKeyDown);

  if (isPastDeadline) return;

  // File selection handling
  const fileInput = backdrop.querySelector("#modal-file-input");
  const idleBox = backdrop.querySelector("#dropzone-idle");
  const selectedBox = backdrop.querySelector("#dropzone-selected");
  const nameLabel = backdrop.querySelector("#selected-filename");
  const sizeLabel = backdrop.querySelector("#selected-filesize");
  const clearBtn = backdrop.querySelector("#btn-clear-file");
  const urlInput = backdrop.querySelector("#modal-url-input");
  const errorBox = backdrop.querySelector("#modal-submit-error");
  const form = backdrop.querySelector("#modal-submit-form");
  const submitBtn = backdrop.querySelector("#modal-submit-btn");
  const submitBtnText = backdrop.querySelector("#modal-submit-btn-text");

  let selectedFile = null;

  const showFile = (file) => {
    selectedFile = file;
    if (nameLabel) nameLabel.textContent = file.name;
    if (sizeLabel) sizeLabel.textContent = formatFileSize(file.size);
    if (idleBox) idleBox.style.display = "none";
    if (selectedBox) selectedBox.style.display = "flex";
    if (errorBox) errorBox.style.display = "none";
  };

  const clearFile = () => {
    selectedFile = null;
    if (fileInput) fileInput.value = "";
    if (idleBox) idleBox.style.display = "block";
    if (selectedBox) selectedBox.style.display = "none";
  };

  clearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearFile();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      if (errorBox) {
        errorBox.textContent = `Invalid file format (${ext}). Please upload a PDF, ZIP, or code file (.pdf, .zip, .js, .py, .java, etc.)`;
        errorBox.style.display = "block";
      }
      clearFile();
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      if (errorBox) {
        errorBox.textContent = "File exceeds the 50MB limit. Please upload a smaller file or provide a project repository URL.";
        errorBox.style.display = "block";
      }
      clearFile();
      return;
    }

    showFile(file);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.style.display = "none";

    const enteredUrl = urlInput?.value?.trim() || "";

    if (!selectedFile && !enteredUrl) {
      if (errorBox) {
        errorBox.textContent = "Please choose a file to upload (PDF, ZIP, or code) or provide a project URL.";
        errorBox.style.display = "block";
      }
      return;
    }

    // Disable submit button & show loading state
    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = "Submitting...";

    try {
      if (selectedFile) {
        // Read file as base64
        const reader = new FileReader();
        reader.onerror = () => {
          throw new Error("Failed to read file");
        };
        reader.onload = async () => {
          try {
            const fileData = reader.result;
            await assignmentService.submitAssignment(assignment._id, {
              fileName: selectedFile.name,
              fileData: fileData,
              fileUrl: enteredUrl || undefined,
            });
            toast("Assignment submitted successfully!", "success");
            close();
            if (onSubmitted) await onSubmitted();
          } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            if (submitBtnText) submitBtnText.textContent = prevSub ? "Update Submission" : "Submit Assignment";
            if (errorBox) {
              errorBox.textContent = errorText(err) || "Failed to submit assignment. Please try again.";
              errorBox.style.display = "block";
            }
          }
        };
        reader.readAsDataURL(selectedFile);
      } else {
        await assignmentService.submitAssignment(assignment._id, {
          fileUrl: enteredUrl,
        });
        toast("Assignment submitted successfully!", "success");
        close();
        if (onSubmitted) await onSubmitted();
      }
    } catch (err) {
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = prevSub ? "Update Submission" : "Submit Assignment";
      if (errorBox) {
        errorBox.textContent = errorText(err) || "Failed to submit assignment. Please try again.";
        errorBox.style.display = "block";
      }
    }
  });
}

