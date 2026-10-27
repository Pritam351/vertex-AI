
const service = require("./assignmentService");

const {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} = require("./assignmentValidation");

const validate = (schema, body, res) => {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
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

const submitAssignment = async (req, res, next) => {
  try {
    const data = validate(submitAssignmentSchema, req.body, res);
    if (!data) return;

    const submission = await service.submitAssignment(
      req.params.id,
      data.fileUrl,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Assignment submitted",
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
  submitAssignment,
  getMySubmissions,
  gradeSubmission,
  listCourseSubmissions,
};
