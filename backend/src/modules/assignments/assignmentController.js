const fs = require("fs");
const path = require("path");
const service = require("./assignmentService");

const {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} = require("./assignmentValidation");

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".zip", ".rar", ".7z", ".tar", ".gz",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".cs",
  ".html", ".css", ".json", ".txt", ".md", ".sql", ".php", ".rb", ".go", ".rs", ".swift", ".kt"
]);

const validate = (schema, body, res) => {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: result.error.issues?.[0]?.message || "Validation failed",
      errors: result.error.issues,
    });
    return null;
  }

  return result.data;
};

const createAssignment = async (req, res, next) => {
  try {
    const data = validate(createAssignmentSchema, req.body, res);
    if (!data) return;

    const assignment = await service.createAssignment(data, req.user);

    return res.status(201).json({
      success: true,
      message: "Assignment created",
      data: { assignment },
    });
  } catch (error) {
    next(error);
  }
};

const listCourseAssignments = async (req, res, next) => {
  try {
    const assignments = await service.listCourseAssignments(
      req.params.courseId,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    next(error);
  }
};

const getEnrolledAssignments = async (req, res, next) => {
  try {
    const assignments = await service.getEnrolledAssignments(req.user);

    return res.status(200).json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    next(error);
  }
};

const getAssignment = async (req, res, next) => {
  try {
    const assignment = await service.getAssignmentById(req.params.id, req.user);

    return res.status(200).json({
      success: true,
      data: { assignment },
    });
  } catch (error) {
    next(error);
  }
};

const submitAssignment = async (req, res, next) => {
  try {
    const data = validate(submitAssignmentSchema, req.body, res);
    if (!data) return;

    let finalFileUrl = data.fileUrl;

    // Handle uploaded file content (base64)
    if (data.fileData && data.fileData.length > 0) {
      const originalName = (data.fileName || "submission.zip").trim();
      const ext = path.extname(originalName).toLowerCase();

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Allowed files: PDF (.pdf), ZIP archives (.zip, .rar, .7z), or code/text files (.js, .py, .java, .cpp, .html, .css, etc.)",
        });
      }

      const uploadsDir = path.join(__dirname, "../../../uploads/assignments");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const base64Payload = data.fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Payload, "base64");

      if (buffer.length > 50 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: "File size exceeds 50MB limit",
        });
      }

      const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const savedFileName = `${safeBase}-${uniqueSuffix}${ext}`;
      const fullPath = path.join(uploadsDir, savedFileName);

      fs.writeFileSync(fullPath, buffer);

      const host = req.get("host") || "localhost:5000";
      const protocol = req.protocol || "http";
      finalFileUrl = `${protocol}://${host}/uploads/assignments/${savedFileName}`;
    }

    if (!finalFileUrl) {
      return res.status(400).json({
        success: false,
        message: "No file upload or URL provided",
      });
    }

    const submission = await service.submitAssignment(
      req.params.id,
      finalFileUrl,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await service.getMySubmissions(req.user._id);

    return res.status(200).json({
      success: true,
      data: { submissions },
    });
  } catch (error) {
    next(error);
  }
};

const gradeSubmission = async (req, res, next) => {
  try {
    const data = validate(gradeSubmissionSchema, req.body, res);
    if (!data) return;

    const submission = await service.gradeSubmission(
      req.params.id,
      data,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Submission graded",
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
};

const listCourseSubmissions = async (req, res, next) => {
  try {
    const submissions = await service.listCourseSubmissions(
      req.params.courseId,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: { submissions },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  listCourseAssignments,
  getEnrolledAssignments,
  getAssignment,
  submitAssignment,
  getMySubmissions,
  gradeSubmission,
  listCourseSubmissions,
};
