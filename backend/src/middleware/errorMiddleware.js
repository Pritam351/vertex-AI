
const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // ── Normalise Mongoose / driver errors to safe HTTP responses ──────────────

  // Mongoose CastError: bad ObjectId format
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field '${err.path}'`,
    });
  }

  // Mongoose ValidationError: schema-level failures
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      success: false,
      message: messages.join(". "),
    });
  }

  // MongoDB duplicate-key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists`,
    });
  }

  // ── Generic fallback ────────────────────────────────────────────────────────
  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    // Never leak internal detail for server faults
    message: statusCode >= 500 ? "Internal server error" : err.message || "Request failed",
  });
};

module.exports = errorMiddleware;
