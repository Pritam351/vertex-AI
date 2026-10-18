
const mongoose = require("mongoose");

const Course = require("../modules/courses/courseModel");
const Quiz = require("../modules/quizzes/quizModel");
const QuizAttempt = require("../modules/quizzes/quizAttemptModel");
const Enrollment = require("../modules/enrollments/enrollmentModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const getStudyPlan = async (courseId, user, requestedDays = 7) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const days = Number(requestedDays);

  if (!Number.isInteger(days) || days < 1 || days > 30) {
    fail(400, "Study plan days must be between 1 and 30");
  }

  const course = await Course.findOne({
    _id: courseId,
    status: "approved",
  }).lean();

  if (!course) {
    fail(404, "Approved course not found");
  }

  const enrolled = await Enrollment.exists({
    userId: user._id,
    courseId: course._id,
  });

  if (!enrolled) {
    fail(403, "Enroll in this course first");
  }

  const quizzes = await Quiz.find({
    courseId: course._id,
    isPublished: true,
  })
    .select("title passingScore createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const attempts = await QuizAttempt.find({
    userId: user._id,
    status: "submitted",
  })
    .populate({
      path: "quizId",
      select: "title courseId passingScore",
    })
    .sort({ submittedAt: -1 })
    .lean();

  // Keep only the latest submitted attempt for each quiz in this course.
  const latestAttempts = new Map();

  for (const attempt of attempts) {
    const quiz = attempt.quizId;

    if (!quiz || quiz.courseId.toString() !== course._id.toString()) {
      continue;
    }

    const quizId = quiz._id.toString();

    if (!latestAttempts.has(quizId)) {
      latestAttempts.set(quizId, attempt);
    }
  }

  const topics = quizzes.map((quiz) => {
    const attempt = latestAttempts.get(quiz._id.toString());
    const score = attempt ? attempt.percentage : null;

    let mastery;
    let recommendation;
    let priority;

    if (score === null) {
      mastery = "not_assessed";
      recommendation = "Take the quiz, then review the topics you find difficult.";
      priority = 1;
    } else if (score < 50) {
      mastery = "needs_revision";
      recommendation = "Revise this topic and retake its quiz.";
      priority = 0;
    } else if (score <= 75) {
      mastery = "developing";
      recommendation = "Practice intermediate questions and review mistakes.";
      priority = 1;
    } else {
      mastery = "strong";
      recommendation = "Try advanced practice to strengthen your understanding.";
      priority = 2;
    }

    return {
      quizId: quiz._id,
      topic: quiz.title,
      latestScore: score,
      passed: attempt ? attempt.passed : null,
      mastery,
      recommendation,
      priority,
      lastAttemptAt: attempt ? attempt.submittedAt : null,
    };
  });

  // Weak topics first, then unassessed topics, then strong topics.
  topics.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    if (a.latestScore === null) return -1;
    if (b.latestScore === null) return 1;

    return a.latestScore - b.latestScore;
  });

  const assessedTopics = topics.filter(
    (topic) => topic.latestScore !== null
  );

  const averageScore = assessedTopics.length
    ? Math.round(
        (assessedTopics.reduce((sum, topic) => sum + topic.latestScore, 0) /
          assessedTopics.length) *
          100
      ) / 100
    : null;

  const plan = Array.from({ length: days }, (_, index) => {
    const topic = topics[index % Math.max(topics.length, 1)];

    if (!topic) {
      return {
        day: index + 1,
        topic: course.title,
        activity:
          "Study the course lessons, take available quizzes, and review your notes.",
      };
    }

    return {
      day: index + 1,
      topic: topic.topic,
      quizId: topic.quizId,
      activity:
        topic.mastery === "needs_revision"
          ? "Revise the lesson and retry the quiz."
          : topic.mastery === "developing"
            ? "Review mistakes and practise intermediate questions."
            : topic.mastery === "strong"
              ? "Practise advanced questions and reinforce your knowledge."
              : "Study the lesson and attempt this quiz for the first time.",
    };
  });

  const recommendations = topics.map(
    ({ quizId, topic, latestScore, mastery, recommendation }) => ({
      quizId,
      topic,
      latestScore,
      mastery,
      recommendation,
    })
  );

  return {
    course: {
      courseId: course._id,
      title: course.title,
      difficulty: course.difficulty,
    },
    mastery: {
      assessedTopics: assessedTopics.length,
      totalTopics: topics.length,
      averageScore,
      topics,
    },
    studyPlan: plan,
    recommendations,
  };
};

module.exports = { getStudyPlan };
