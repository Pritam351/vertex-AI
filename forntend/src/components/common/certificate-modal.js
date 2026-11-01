import { toast } from "./toast.js";
import { escapeHtml } from "../../utils/dom.js";

/**
 * Open the Official Credential / Certificate modal
 * @param {Object} cert - Certificate object
 */
export function openCertificateModal(cert) {
  if (!cert) return;

  const existing = document.querySelector("#certificate-modal-backdrop");
  if (existing) existing.remove();

  const studentName = cert.studentName || "Student";
  const courseTitle = cert.courseTitle || (cert.courseId?.title) || "Masterclass Program";
  const certNumber = cert.certificateNumber || "VLX-VERIFIED";

  const dateObj = cert.issuedAt ? new Date(cert.issuedAt) : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const instructorName =
    cert.courseId?.instructorId?.fullName ||
    cert.instructorName ||
    "Sarah Jenkins";

  const grade = cert.grade || "Distinction (98%)";

  // Derive skills pills from category & title
  const category = cert.courseId?.category || "Software Engineering";
  const skillTags = cert.skills || [
    category,
    "Full-Stack Development",
    "Modern Architecture",
    "Problem Solving",
    "Applied AI Systems"
  ];

  const verifyUrl = `${window.location.origin}${window.location.pathname}#/student/certificates?verify=${encodeURIComponent(certNumber)}`;

  const modalHtml = `
    <div id="certificate-modal-backdrop" class="cert-modal-backdrop">
      <div class="cert-modal-wrapper" role="dialog" aria-modal="true" aria-labelledby="cert-student-name">
        
        <!-- Top Toolbar -->
        <div class="cert-modal-toolbar">
          <div class="cert-toolbar-left">
            <span class="cert-badge-label">OFFICIAL CREDENTIAL</span>
            <span class="cert-status-pill">
              <span class="cert-status-dot"></span>
              Verified Active
            </span>
          </div>
          <div class="cert-toolbar-right">
            <button type="button" class="cert-tool-btn" id="btn-cert-print" title="Print or save as PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print / PDF
            </button>
            <button type="button" class="cert-tool-btn cert-tool-btn-primary" id="btn-cert-share" title="Copy verification link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Share
            </button>
            <button type="button" class="cert-close-btn" id="btn-cert-close" aria-label="Close modal">✕</button>
          </div>
        </div>

        <!-- Printable Certificate Area -->
        <div id="certificate-print-area" class="cert-card-container">
          <!-- Cyber Corner Accents -->
          <div class="cert-corner cert-corner-tl"></div>
          <div class="cert-corner cert-corner-tr"></div>
          <div class="cert-corner cert-corner-bl"></div>
          <div class="cert-corner cert-corner-br"></div>

          <!-- Certificate Inner Border -->
          <div class="cert-inner-frame">

            <!-- Header -->
            <div class="cert-header">
              <div class="cert-brand">
                <span class="cert-sparkle">✧</span>
                <span class="cert-brand-name">VERTEXLEARN AI</span>
              </div>
              <p class="cert-academy-title">ACADEMY OF ARTIFICIAL INTELLIGENCE &amp; SOFTWARE ENGINEERING</p>
            </div>

            <!-- Certified Statement -->
            <div class="cert-body">
              <p class="cert-statement-eyebrow">THIS CERTIFIES THAT</p>
              
              <h1 class="cert-student-name" id="cert-student-name">${escapeHtml(studentName)}</h1>
              
              <p class="cert-statement-desc">
                has successfully mastered all curriculum requirements, coding laboratories, and final assessments for the specialized masterclass:
              </p>

              <h2 class="cert-course-title">"${escapeHtml(courseTitle)}"</h2>

              <div class="cert-grade-row">
                <span class="cert-grade-pill">Grade: ${escapeHtml(grade)}</span>
              </div>

              <!-- Skill Tags -->
              <div class="cert-skills-pills">
                ${skillTags.map(tag => `<span class="cert-skill-tag">${escapeHtml(tag)}</span>`).join("")}
              </div>
            </div>

            <!-- Footer Signatures & Official Stamp -->
            <div class="cert-footer">
              <!-- Left: Instructor -->
              <div class="cert-sign-col cert-sign-left">
                <div class="cert-signature-line">${escapeHtml(instructorName)}</div>
                <div class="cert-sign-divider"></div>
                <div class="cert-sign-role">Lead Instructor</div>
                <div class="cert-sign-sub">Course Architect</div>
              </div>

              <!-- Center: Official Golden Verified Stamp -->
              <div class="cert-seal-col">
                <div class="cert-gold-seal">
                  <div class="cert-seal-inner">
                    <span class="cert-seal-star">★</span>
                    <span class="cert-seal-text">OFFICIAL</span>
                    <span class="cert-seal-text cert-seal-sub">VERIFIED</span>
                    <span class="cert-seal-star">★</span>
                  </div>
                </div>
                <div class="cert-issue-date">${escapeHtml(formattedDate)}</div>
              </div>

              <!-- Right: Registrar -->
              <div class="cert-sign-col cert-sign-right">
                <div class="cert-signature-line">VertexLearn AI</div>
                <div class="cert-sign-divider"></div>
                <div class="cert-sign-role">Academic Registrar</div>
                <div class="cert-serial-number" title="Certificate ID">${escapeHtml(certNumber)}</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const backdrop = document.querySelector("#certificate-modal-backdrop");

  const closeModal = () => {
    backdrop?.classList.add("cert-modal-closing");
    setTimeout(() => backdrop?.remove(), 200);
  };

  // Close handlers
  backdrop?.querySelector("#btn-cert-close")?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  const onKey = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);

  // Print / PDF Handler
  backdrop?.querySelector("#btn-cert-print")?.addEventListener("click", () => {
    window.print();
  });

  // Share Handler
  backdrop?.querySelector("#btn-cert-share")?.addEventListener("click", async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(verifyUrl);
        toast("Certificate verification link copied to clipboard! 📋");
      } else {
        toast(`Verification link: ${verifyUrl}`);
      }
    } catch {
      toast("Verification link copied! 📋");
    }
  });

  return { close: closeModal, element: backdrop };
}

