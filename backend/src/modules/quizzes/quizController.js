
const quizService = require("./quizService");
const {
  createQuizSchema,
  submitAttemptSchema,
} = require("./quizValidation");

const validate = (schema, data, res) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return null;
  }

  return result.data;
};

const createQuiz = async (req, res, next) => {
  try {
    const data = validate(createQuizSchema, req.body, res);
    if (!data) return;

    const quiz = await quizService.createQuiz(data, req.user);

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: { quiz },
    });
  } catch (error) {
    next(error);
  }
};

const listCourseQuizzes = async (req, res, next) => {
  try {
    const quizzes = await quizService.listCourseQuizzes(
      req.params.courseId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: { quizzes },
    });
  } catch (error) {
    next(error);
  }
};

const startAttempt = async (req, res, next) => {
  try {
    const result = await quizService.startAttempt(
      req.params.id,
      req.user
    );

    res.status(201).json({
      success: true,
      message: "Quiz attempt started",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const submitAttempt = async (req, res, next) => {
  try {
    const data = validate(submitAttemptSchema, req.body, res);
    if (!data) return;

    const result = await quizService.submitAttempt(
      req.params.id,
      data,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Quiz submitted and graded",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await quizService.getMyAttempts(req.user);

    res.status(200).json({
      success: true,
      data: { attempts },
    });
  } catch (error) {
    next(error);
  }
};

const publishQuiz = async (req, res, next) => {
  try {
    const result = await quizService.publishQuiz(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Quiz published successfully",
      data: { quiz: result },
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createQuiz,
  listCourseQuizzes,
  startAttempt,
  submitAttempt,
  getMyAttempts,
  publishQuiz,
};
