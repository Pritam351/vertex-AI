const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./modules/auth/authRoutes");
const courseRoutes = require("./modules/courses/courseRoutes");
const contentRoutes = require("./modules/courses/contentRoutes");
const adminRoutes = require("./modules/admin/adminRoutes");
const enrollmentRoutes = require("./modules/enrollments/enrollmentRoutes");
const learningRoutes = require("./modules/enrollments/learningRoutes");
const assignmentRoutes = require("./modules/assignments/assignmentRoutes");
const quizRoutes = require("./modules/quizzes/quizRoutes");

const errorMiddleware = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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

app.use(errorMiddleware);

module.exports = app;