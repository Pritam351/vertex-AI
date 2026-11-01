import { certificateService } from "../../services/certificateService.js";
import { openCertificateModal } from "../../components/common/certificate-modal.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { errorText } from "../../utils/validation.js";

export async function mountStudentCertificates(container) {
  const loadingEl = $("#certificates-loading", container);
  const emptyEl = $("#certificates-empty", container);
  const gridEl = $("#certificates-grid", container);
  const countPill = $("#certificates-count", container);

  const verifyForm = $("#cert-verify-form", container);
  const verifyInput = $("#cert-verify-input", container);
  const verifyResult = $("#cert-verify-result", container);

  // Check URL params for verify query (e.g. #/student/certificates?verify=VERTEX-...)
  const hashParts = window.location.hash.split("?");
  if (hashParts[1]) {
    const params = new URLSearchParams(hashParts[1]);
    const verifyId = params.get("verify");
    if (verifyId && verifyInput) {
      verifyInput.value = verifyId;
      triggerVerify(verifyId);
    }
  }

  // Load student's certificates
  try {
    const payload = await certificateService.getMyCertificates();
    const certificates = payload?.data?.certificates || payload?.certificates || [];

    if (loadingEl) loadingEl.hidden = true;

    if (countPill) {
      countPill.textContent = `${certificates.length} earned`;
    }

    if (!certificates.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (gridEl) gridEl.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (gridEl) {
      gridEl.hidden = false;
      gridEl.innerHTML = certificates
        .map((cert) => {
          const dateStr = cert.issuedAt
            ? new Date(cert.issuedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Verified";

          const course = cert.courseId || {};
          const title = cert.courseTitle || course.title || "Course Certificate";
          const category = course.category || "Development";
          const certNumber = cert.certificateNumber || "VLX-VERIFIED";

          return `
            <article class="certificate-item-card">
              <div>
                <div class="course-badges-row" style="margin-bottom:0.75rem;">
                  <span class="course-badge">${escapeHtml(category)}</span>
                  <span class="cert-status-pill" style="font-size:0.7rem; padding:0.18rem 0.55rem;">
                    <span class="cert-status-dot"></span> Verified Active
                  </span>
                </div>

                <h3 class="cert-item-title">${escapeHtml(title)}</h3>
                <p class="cert-item-meta">
                  Awarded to <strong style="color:#e2e8f0;">${escapeHtml(cert.studentName || "Student")}</strong> on ${escapeHtml(dateStr)}.
                </p>

                <div class="cert-item-serial-box">
                  <div style="min-width:0; flex:1;">
                    <span style="font-size:0.65rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:0.15rem;">Credential ID</span>
                    <code class="cert-item-serial-code" title="${escapeHtml(certNumber)}">${escapeHtml(certNumber)}</code>
                  </div>
                  <button type="button" class="mini-button button button-ghost btn-copy-serial-code" data-copy-text="${escapeHtml(certNumber)}" title="Copy Credential ID" style="padding:0.25rem 0.55rem; font-size:0.8rem;">
                    📋
                  </button>
                </div>
              </div>

              <div class="cert-item-actions">
                <button type="button" class="button button-primary mini-button btn-view-cert" data-cert-id="${cert._id}">
                  🎓 View Credential
                </button>
                <button type="button" class="button button-secondary mini-button btn-share-cert" data-cert-num="${escapeHtml(certNumber)}">
                  🔗 Share
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      // Bind view credential handlers
      gridEl.querySelectorAll(".btn-view-cert").forEach((btn) => {
        btn.addEventListener("click", () => {
          const certId = btn.dataset.certId;
          const targetCert = certificates.find((c) => String(c._id) === String(certId));
          if (targetCert) {
            openCertificateModal(targetCert);
          }
        });
      });

      // Bind share handlers
      gridEl.querySelectorAll(".btn-share-cert").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const num = btn.dataset.certNum;
          const shareUrl = `${window.location.origin}${window.location.pathname}#/student/certificates?verify=${encodeURIComponent(num)}`;
          try {
            await navigator.clipboard.writeText(shareUrl);
            toast("Verification link copied to clipboard! 📋");
          } catch {
            toast(`Verification link: ${shareUrl}`);
          }
        });
      });

      // Bind copy serial code handlers
      gridEl.querySelectorAll(".btn-copy-serial-code").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const text = btn.dataset.copyText;
          try {
            await navigator.clipboard.writeText(text);
            toast("Credential ID copied! 📋");
          } catch {
            toast(`Credential ID: ${text}`);
          }
        });
      });
    }
  } catch (err) {
    if (loadingEl) loadingEl.hidden = true;
    toast(`Failed to load certificates: ${errorText(err)}`, "error");
  }

  // Handle Verification Form Submission
  async function triggerVerify(number) {
    if (!verifyResult) return;
    verifyResult.hidden = false;
    verifyResult.innerHTML = `<p style="font-size:0.85rem; color:var(--muted); margin:0;">Verifying credential ${escapeHtml(number)}…</p>`;

    try {
      const res = await certificateService.verifyCertificate(number.trim());
      const cert = res?.data?.certificate || res?.certificate;
      if (!cert) throw new Error("Certificate not found");

      const dateStr = cert.issuedAt
        ? new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "Verified";

      verifyResult.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.3); border-radius:8px; padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
              <span style="color:#34d399; font-weight:700; font-size:0.9rem;">✓ Authenticated Official Certificate</span>
              <span class="cert-status-pill" style="font-size:0.68rem; padding:0.15rem 0.5rem;"><span class="cert-status-dot"></span> Valid</span>
            </div>
            <p style="margin:0.2rem 0; font-size:0.85rem; color:#f8fafc;">
              Issued to <strong>${escapeHtml(cert.studentName)}</strong> for <strong>"${escapeHtml(cert.courseTitle)}"</strong>
            </p>
            <span style="font-size:0.75rem; color:var(--muted);">Issue Date: ${escapeHtml(dateStr)} • Serial: ${escapeHtml(cert.certificateNumber)}</span>
          </div>
          <button type="button" class="button button-primary mini-button" id="btn-open-verified-cert">
            View Full Certificate 🎓
          </button>
        </div>
      `;

      verifyResult.querySelector("#btn-open-verified-cert")?.addEventListener("click", () => {
        openCertificateModal(cert);
      });
    } catch (err) {
      verifyResult.innerHTML = `
        <div style="background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px; padding:0.85rem 1.15rem; color:#fca5a5; font-size:0.85rem;">
          ✕ Invalid Certificate ID: We could not find an official credential matching "<strong>${escapeHtml(number)}</strong>". Please verify the certificate number and try again.
        </div>
      `;
    }
  }

  verifyForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = verifyInput?.value?.trim();
    if (query) triggerVerify(query);
  });
}

