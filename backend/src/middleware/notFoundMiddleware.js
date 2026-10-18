
const notFoundMiddleware = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
};

module.exports = notFoundMiddleware;
