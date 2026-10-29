const mongoose = require("mongoose");
const Quiz = require("./quizModel");
const QuizAttempt = require("./quizAttemptModel");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validId = (id) => mongoose.isValidObjectId(id);

const getQuiz = async (id) => {
  if (!validId(id)) fail(400, "Invalid quiz ID");

  const quiz = await Quiz.findById(id);
  if (!quiz) fail(404, "Quiz not found");

  return quiz;
};

const createQuiz = async (data, user) => {
  const course = await Course.findById(data.courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot create quizzes for another instructor's course");
  }

  const questions = data.questions.map((question, index) => {
    const options = question.options || [];

    if (question.type === "mcq") {
      if (options.length < 2) {
        fail(400, "MCQ questions require at least two options");
      }
      if (options.filter((option) => option.isCorrect === true).length !== 1) {
        fail(400, "MCQ questions must have exactly one correct option");
      }
    }

    if (question.type === "multi_select") {
      if (options.length < 2) {
        fail(400, "Multi-select questions require at least two options");
      }
      if (!options.some((option) => option.isCorrect === true)) {
        fail(400, "Multi-select questions need a correct option");
      }
    }

    if (
      question.type === "short_answer" &&
      !question.correctAnswer?.trim()
    ) {
      fail(400, "Short-answer questions require a correct answer");
    }

    return {
      ...question,
      options,
      orderIndex: question.orderIndex ?? index,
    };
  });

  const quiz = await Quiz.create({
    ...data,
    questions,
    createdBy: user._id,
  });

  // If created already published, notify students
  if (quiz.isPublished) {
    try {
      const { createBulkNotifications } = require("../notifications/notificationService");
      const enrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
      if (enrollments.length > 0) {
        await createBulkNotifications(
          enrollments.map((e) => ({
            userId: e.userId,
            type: "quiz",
            title: `New Quiz: ${quiz.title}`,
            message: `A new quiz "${quiz.title}" has been added to "${course.title}". Test your knowledge!`,
            link: "#/student/quizzes",
          }))
        );
      }
    } catch (_) {}
  }

  return quiz;
};

const listCourseQuizzes = async (courseId, user) => {
  if (!validId(courseId)) fail(400, "Invalid course ID");

  const course = await Course.findById(courseId);
  if (!course) fail(404, "Course not found");

  if (user.role === "student") {
    if (course.status !== "approved") fail(404, "Course not found");

    const enrolled = await Enrollment.exists({
      userId: user._id,
      courseId: course._id,
    });

    if (!enrolled) fail(403, "Enroll in this course first");

    const quizzes = await Quiz.find({
      courseId: course._id,
      isPublished: true,
    })
      .select("-questions.options.isCorrect -questions.correctAnswer")
      .sort({ createdAt: -1 })
      .lean();

    return quizzes;
  }

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot view quizzes for another instructor's course");
  }

  return Quiz.find({ courseId: course._id })
    .sort({ createdAt: -1 })
    .lean();
};

const startAttempt = async (quizId, user) => {
  const quiz = await getQuiz(quizId);

  if (user.role !== "admin") {
    if (user.role !== "student") {
      fail(403, "Only students can attempt quizzes");
    }

    if (!quiz.isPublished) fail(404, "Quiz not found");

    const course = await Course.findOne({
      _id: quiz.courseId,
      status: "approved",
    });

    if (!course) fail(404, "Approved course not found");

    const enrolled = await Enrollment.exists({
      userId: user._id,
      courseId: quiz.courseId,
    });

    if (!enrolled) fail(403, "Enroll in this course first");
  }

  const attempt = await QuizAttempt.create({
    quizId: quiz._id,
    userId: user._id,
    totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
  });

  // Never send correct answers to the student.
  return {
    attempt,
    quiz: {
      _id: quiz._id,
      title: quiz.title,
      instructions: quiz.instructions,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questions: quiz.questions.map((q) => ({
        _id: q._id,
        text: q.text,
        type: q.type,
        points: q.points,
        orderIndex: q.orderIndex,
        options: q.options.map((option) => ({
          _id: option._id,
          text: option.text,
        })),
      })),
    },
  };
};

const submitAttempt = async (attemptId, data, user) => {
  if (!validId(attemptId)) fail(400, "Invalid attempt ID");

  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt) fail(404, "Quiz attempt not found");

  if (
    user.role !== "admin" &&
    attempt.userId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot submit another user's attempt");
  }

  if (attempt.status === "submitted") {
    fail(409, "This attempt has already been submitted");
  }

  const quiz = await getQuiz(attempt.quizId);
  const submittedById = new Map(
    data.answers.map((answer) => [answer.questionId, answer])
  );

  // Reject unknown or duplicate question IDs.
  if (
    submittedById.size !== data.answers.length ||
    data.answers.some(
      (answer) => !quiz.questions.some(
        (question) => question._id.toString() === answer.questionId
      )
    )
  ) {
    fail(400, "Answers contain duplicate or invalid question IDs");
  }

  let score = 0;

  const gradedAnswers = quiz.questions.map((question) => {
    const answer = submittedById.get(question._id.toString());
    let awardedPoints = 0;

    if (answer && question.type === "mcq") {
      const correct = question.options.find((option) => option.isCorrect);
      const selected = answer.selectedOptionIds || [];

      if (
        selected.length === 1 &&
        correct &&
        selected[0] === correct._id.toString()
      ) {
        awardedPoints = question.points;
      }
    }

    if (answer && question.type === "multi_select") {
      const correctIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option._id.toString())
        .sort();

      const selectedIds = [...(answer.selectedOptionIds || [])].sort();

      if (
        new Set(selectedIds).size === selectedIds.length &&
        correctIds.length === selectedIds.length &&
        correctIds.every((id, index) => id === selectedIds[index])
      ) {
        awardedPoints = question.points;
      }
    }

    if (answer && question.type === "short_answer") {
      const normalize = (value) =>
        value.trim().replace(/\s+/g, " ").toLowerCase();

      if (
        normalize(answer.textAnswer || "") ===
        normalize(question.correctAnswer)
      ) {
        awardedPoints = question.points;
      }
    }

    score += awardedPoints;

    return {
      questionId: question._id,
      selectedOptionIds: answer?.selectedOptionIds || [],
      textAnswer: answer?.textAnswer || "",
      awardedPoints,
    };
  });

  const totalPoints = quiz.questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  const percentage = totalPoints
    ? Math.round((score / totalPoints) * 10000) / 100
    : 0;

  attempt.answers = gradedAnswers;
  attempt.score = score;
  attempt.totalPoints = totalPoints;
  attempt.percentage = percentage;
  attempt.passed = percentage >= quiz.passingScore;
  attempt.status = "submitted";
  attempt.submittedAt = new Date();

  await attempt.save();

  // Notify student of their quiz result
  try {
    const { createNotification } = require("../notifications/notificationService");
    await createNotification({
      userId: user._id,
      type: "quiz",
      title: attempt.passed ? `Passed: ${quiz.title}` : `Completed: ${quiz.title}`,
      message: attempt.passed
        ? `Great job! You passed "${quiz.title}" with a score of ${percentage}%.`
        : `You completed "${quiz.title}" with ${percentage}%. Review and try again!`,
      link: "#/student/quizzes",
    });
  } catch (_) {}

  return {
    attemptId: attempt._id,
    score,
    totalPoints,
    percentage,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
  };
};

const getMyAttempts = async (user) => {
  return QuizAttempt.find({ userId: user._id })
    .populate("quizId", "title courseId passingScore")
    .sort({ startedAt: -1 })
    .lean();
};

const publishQuiz = async (quizId, user) => {
  if (!validId(quizId)) fail(400, "Invalid quiz ID");

  const quiz = await Quiz.findById(quizId);
  if (!quiz) fail(404, "Quiz not found");

  const course = await Course.findById(quiz.courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot publish quizzes for another instructor's course");
  }

  quiz.isPublished = true;
  await quiz.save();

  // Notify students enrolled in this course
  try {
    const { createBulkNotifications } = require("../notifications/notificationService");
    const enrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
    if (enrollments.length > 0) {
      await createBulkNotifications(
        enrollments.map((e) => ({
          userId: e.userId,
          type: "quiz",
          title: `New Quiz: ${quiz.title}`,
          message: `A new quiz "${quiz.title}" has been published for "${course.title}". Test your knowledge!`,
          link: "#/student/quizzes",
        }))
      );
    }
  } catch (_) {}

  return {
    quizId: quiz._id,
    title: quiz.title,
    isPublished: quiz.isPublished,
  };
};

const updateQuiz = async (quizId, data, user) => {
  if (!validId(quizId)) fail(400, "Invalid quiz ID");

  const quiz = await Quiz.findById(quizId);
  if (!quiz) fail(404, "Quiz not found");

  const course = await Course.findById(quiz.courseId);
  if (!course) fail(404, "Course not found");

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You cannot edit quizzes for another instructor's course");
  }

  const wasPublished = quiz.isPublished;

  if (data.title) quiz.title = data.title;
  if (data.instructions !== undefined) quiz.instructions = data.instructions;
  if (data.passingScore !== undefined) quiz.passingScore = data.passingScore;
  if (data.timeLimitMinutes !== undefined) quiz.timeLimitMinutes = data.timeLimitMinutes;
  if (data.isPublished !== undefined) quiz.isPublished = data.isPublished;

  if (Array.isArray(data.questions) && data.questions.length > 0) {
    quiz.questions = data.questions.map((question, index) => {
      const options = question.options || [];

      if (question.type === "mcq") {
        if (options.length < 2) {
          fail(400, "MCQ questions require at least two options");
        }
        if (options.filter((option) => option.isCorrect === true).length !== 1) {
          fail(400, "MCQ questions must have exactly one correct option");
        }
      }

      if (question.type === "multi_select") {
        if (options.length < 2) {
          fail(400, "Multi-select questions require at least two options");
        }
        if (!options.some((option) => option.isCorrect === true)) {
          fail(400, "Multi-select questions need a correct option");
        }
      }

      if (
        question.type === "short_answer" &&
        !question.correctAnswer?.trim()
      ) {
        fail(400, "Short-answer questions require a correct answer");
      }

      return {
        ...question,
        options,
        orderIndex: question.orderIndex ?? index,
      };
    });
  }

  await quiz.save();

  // If newly published, notify students
  if (!wasPublished && quiz.isPublished) {
    try {
      const { createBulkNotifications } = require("../notifications/notificationService");
      const enrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
      if (enrollments.length > 0) {
        await createBulkNotifications(
          enrollments.map((e) => ({
            userId: e.userId,
            type: "quiz",
            title: `New Quiz: ${quiz.title}`,
            message: `A new quiz "${quiz.title}" has been published for "${course.title}". Test your knowledge!`,
            link: "#/student/quizzes",
          }))
        );
      }
    } catch (_) {}
  }

  return quiz;
};

module.exports = {
  createQuiz,
  updateQuiz,
  listCourseQuizzes,
  startAttempt,
  submitAttempt,
  getMyAttempts,
  publishQuiz,
};
