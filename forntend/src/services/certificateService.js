import { api } from "./apiClient.js";

export const certificateService = {
  /**
   * Request / issue a certificate for an enrolled course upon completion
   * @param {string} courseId
   */
  async issueCertificate(courseId) {
    return api(`/courses/${encodeURIComponent(courseId)}/certificate`, {
      method: "POST",
    });
  },

  /**
   * Fetch all earned certificates for the logged-in student
   */
  async getMyCertificates() {
    return api("/certificates/me");
  },

  /**
   * Publicly verify a certificate by its unique certificate number
   * @param {string} certificateNumber
   */
  async verifyCertificate(certificateNumber) {
    return api(`/certificates/verify/${encodeURIComponent(certificateNumber)}`, {
      auth: false,
    });
  },
};

