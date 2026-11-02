import { openModal } from "./modal.js";
import { escapeHtml } from "../../utils/dom.js";

/**
 * Opens a project-styled report dialog for discussions and comments.
 * @param {Object} options
 * @param {"thread" | "comment" | "post"} [options.targetType="thread"]
 * @param {string} [options.title]
 * @param {Function} options.onSubmit - async (reason: string) => Promise<void>
 */
export function openReportModal({ targetType = "thread", title, onSubmit }) {
  const isComment = targetType === "comment" || targetType === "post";
  const label = isComment ? "Comment / Reply" : "Discussion Question";
  const modalTitle = title || `🚩 Report ${label}`;

  const contentHtml = `
    <div class="report-modal-content" style="display:flex; flex-direction:column; gap:1.1rem;">
      <p style="margin:0; font-size:0.88rem; color:#cbd5e1; line-height:1.5;">
        Help our moderators maintain a safe and constructive learning community. Why are you reporting this ${isComment ? "comment" : "question"}?
      </p>

      <div class="report-reasons-group" style="display:flex; flex-direction:column; gap:0.6rem;">
        <label style="display:flex; align-items:flex-start; gap:0.65rem; cursor:pointer; font-size:0.86rem; color:#f8fafc; padding:0.65rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid #27314b; border-radius:8px; transition:border-color 0.2s;">
          <input type="radio" name="report_reason_radio" value="Spam, promotional, or repetitive content" checked style="margin-top:0.2rem; accent-color:#f59e0b;">
          <div>
            <strong style="display:block; font-size:0.88rem; color:#f8fafc;">Spam or Advertising</strong>
            <span style="font-size:0.75rem; color:#9da4c2; line-height:1.4; display:block; margin-top:0.15rem;">Commercial promotions, repetitive messages, or irrelevant links.</span>
          </div>
        </label>

        <label style="display:flex; align-items:flex-start; gap:0.65rem; cursor:pointer; font-size:0.86rem; color:#f8fafc; padding:0.65rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid #27314b; border-radius:8px; transition:border-color 0.2s;">
          <input type="radio" name="report_reason_radio" value="Harassment, hate speech, or offensive language" style="margin-top:0.2rem; accent-color:#f59e0b;">
          <div>
            <strong style="display:block; font-size:0.88rem; color:#f8fafc;">Harassment or Hate Speech</strong>
            <span style="font-size:0.75rem; color:#9da4c2; line-height:1.4; display:block; margin-top:0.15rem;">Personal attacks, bullying, hostility, or vulgar language.</span>
          </div>
        </label>

        <label style="display:flex; align-items:flex-start; gap:0.65rem; cursor:pointer; font-size:0.86rem; color:#f8fafc; padding:0.65rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid #27314b; border-radius:8px; transition:border-color 0.2s;">
          <input type="radio" name="report_reason_radio" value="Misleading, incorrect, or off-topic information" style="margin-top:0.2rem; accent-color:#f59e0b;">
          <div>
            <strong style="display:block; font-size:0.88rem; color:#f8fafc;">Off-topic or Misleading</strong>
            <span style="font-size:0.75rem; color:#9da4c2; line-height:1.4; display:block; margin-top:0.15rem;">Content not related to the lesson or containing deceptive claims.</span>
          </div>
        </label>

        <label style="display:flex; align-items:flex-start; gap:0.65rem; cursor:pointer; font-size:0.86rem; color:#f8fafc; padding:0.65rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid #27314b; border-radius:8px; transition:border-color 0.2s;">
          <input type="radio" name="report_reason_radio" value="Other code of conduct violation" style="margin-top:0.2rem; accent-color:#f59e0b;">
          <div>
            <strong style="display:block; font-size:0.88rem; color:#f8fafc;">Other Issue</strong>
            <span style="font-size:0.75rem; color:#9da4c2; line-height:1.4; display:block; margin-top:0.15rem;">Any other violation of platform or course community guidelines.</span>
          </div>
        </label>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.4rem;">
        <label for="report-modal-details" style="font-size:0.8rem; color:#9da4c2; font-weight:600;">
          Additional context or details (optional):
        </label>
        <textarea id="report-modal-details" rows="3" maxlength="500" placeholder="Provide extra details to help moderators review quickly..."
          style="width:100%; box-sizing:border-box; background:#0d1425; border:1px solid #313b57; border-radius:6px; color:#f8fafc; padding:0.6rem 0.8rem; font-size:0.82rem; resize:vertical; line-height:1.5;"></textarea>
      </div>
    </div>
  `;

  openModal({
    title: modalTitle,
    contentHtml,
    confirmText: "Submit Report",
    onConfirm: async (backdrop, close) => {
      const selectedRadio = backdrop.querySelector('input[name="report_reason_radio"]:checked');
      const baseReason = selectedRadio ? selectedRadio.value : "Reported by user";
      const details = backdrop.querySelector("#report-modal-details")?.value?.trim() || "";
      const finalReason = details ? `${baseReason} - ${details}` : baseReason;

      const confirmBtn = backdrop.querySelector(".modal-confirm");
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Submitting...";
      }

      try {
        if (onSubmit) {
          await onSubmit(finalReason);
        }
        close();
      } catch (err) {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Submit Report";
        }
        throw err;
      }
    }
  });
}

