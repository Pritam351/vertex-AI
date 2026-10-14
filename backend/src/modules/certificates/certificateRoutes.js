
const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const requireRole = require("../../middleware/roleMiddleware");

const {
  issueCertificate,
  getMyCertificates,
  verifyCertificate,
} = require("./certificateController");

const router = express.Router();

// Students can request a certificate after completing a course.
router.post(
  "/courses/:courseId/certificate",
  authMiddleware,
  requireRole("student"),
  issueCertificate
);

// A student can view their own certificates.
router.get(
  "/certificates/me",
  authMiddleware,
  requireRole("student"),
  getMyCertificates
);

// Public verification endpoint.
router.get(
  "/certificates/verify/:certificateNumber",
  verifyCertificate
);

module.exports = router;
