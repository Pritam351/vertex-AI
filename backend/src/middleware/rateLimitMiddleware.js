const rateLimit = require("express-rate-limit");

/**
 * Strict limiter for login & registration endpoints.
 * 10 attempts per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,  // Return rate-limit info in `RateLimit-*` headers
  legacyHeaders: false,   // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many attempts. Please try again after 15 minutes.",
  },
});

/**
 * Moderate limiter for AI endpoints.
 * 30 requests per minute per IP.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many AI requests. Please slow down and try again shortly.",
  },
});

module.exports = { authLimiter, aiLimiter };

