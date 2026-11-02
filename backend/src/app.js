const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// ── Guard: fail fast if critical secrets are missing ──────────────────────
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set");
}

const authRoutes = require("./modules/auth/authRoutes");
const courseRoutes = require("./modules/courses/courseRoutes");
const contentRoutes = require("./modules/courses/contentRoutes");
const adminRoutes = require("./modules/admin/adminRoutes");
const enrollmentRoutes = require("./modules/enrollments/enrollmentRoutes");
const learningRoutes = require("./modules/enrollments/learningRoutes");
const assignmentRoutes = require("./modules/assignments/assignmentRoutes");
const quizRoutes = require("./modules/quizzes/quizRoutes");
const certificateRoutes = require("./modules/certificates/certificateRoutes");
const discussionRoutes = require("./modules/discussions/discussionRoutes");
const notificationRoutes = require("./modules/notifications/notificationRoutes");
const gamificationRoutes = require("./modules/gamification/gamificationRoutes");
const announcementRoutes = require("./modules/announcements/announcementRoutes");

const aiRoutes = require("./ai/aiRoutes");

const notFoundMiddleware = require("./middleware/notFoundMiddleware");
const errorMiddleware = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json());

// HTTP request logger — skip in production to avoid body-leaking 'dev' format
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Vertex LMS AI API is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1", contentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1", enrollmentRoutes);
app.use("/api/v1", learningRoutes);
app.use("/api/v1", assignmentRoutes);
app.use("/api/v1", quizRoutes);
app.use("/api/v1", certificateRoutes);
app.use("/api/v1", discussionRoutes);
app.use("/api/v1", notificationRoutes);
app.use("/api/v1", gamificationRoutes);
app.use("/api/v1", announcementRoutes);

app.use("/api/v1/ai", aiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
