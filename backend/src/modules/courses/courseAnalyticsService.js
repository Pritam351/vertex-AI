const mongoose = require("mongoose");
const Course = require("./courseModel");
const CourseModule = require("./moduleModel");
const Lecture = require("./lectureModel");
const Enrollment = require("../enrollments/enrollmentModel");
const LectureProgress = require("../enrollments/lectureProgressModel");
const Quiz = require("../quizzes/quizModel");
const QuizAttempt = require("../quizzes/quizAttemptModel");

const fail = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const getCourseAnalytics = async (courseId, user) => {
  if (!mongoose.isValidObjectId(courseId)) {
    fail(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId).lean();
  if (!course) {
    fail(404, "Course not found");
  }

  if (
    user.role !== "admin" &&
    course.instructorId.toString() !== user._id.toString()
  ) {
    fail(403, "You do not have permission to view analytics for this course");
  }

  // 1. Enrollments & Completion rates
  const enrollments = await Enrollment.find({ courseId })
    .populate("userId", "fullName email avatarUrl")
    .sort({ enrolledAt: -1 })
    .lean();

  const totalEnrolled = enrollments.length;
  const completedEnrollments = enrollments.filter(
    (e) => (e.progressPercent || 0) >= 100
  );
  const completedCount = completedEnrollments.length;
  const inProgressCount = enrollments.filter(
    (e) => (e.progressPercent || 0) > 0 && (e.progressPercent || 0) < 100
  ).length;
  const notStartedCount = enrollments.filter(
    (e) => (e.progressPercent || 0) === 0
  ).length;
  const completionRate =
    totalEnrolled > 0
      ? Math.round((completedCount / totalEnrolled) * 1000) / 10
      : 0;

  // 2. Average Progress & Distribution
  const totalProgress = enrollments.reduce(
    (sum, e) => sum + (e.progressPercent || 0),
    0
  );
  const averageProgress =
    totalEnrolled > 0
      ? Math.round((totalProgress / totalEnrolled) * 10) / 10
      : 0;

  const progressDistribution = {
    notStarted: notStartedCount,
    low: enrollments.filter(
      (e) => e.progressPercent > 0 && e.progressPercent <= 25
    ).length,
    medium: enrollments.filter(
      (e) => e.progressPercent > 25 && e.progressPercent <= 50
    ).length,
    high: enrollments.filter(
      (e) => e.progressPercent > 50 && e.progressPercent <= 75
    ).length,
    advanced: enrollments.filter(
      (e) => e.progressPercent > 75 && e.progressPercent < 100
    ).length,
    completed: completedCount,
  };

  // 3. Quiz Performance & Breakdown
  const quizzes = await Quiz.find({ courseId }).lean();
  const quizIds = quizzes.map((q) => q._id);
  const attempts = await QuizAttempt.find({
    quizId: { $in: quizIds },
    status: "submitted",
  }).lean();

  const totalQuizAttempts = attempts.length;
  const averageQuizScore =
    totalQuizAttempts > 0
      ? Math.round(
          (attempts.reduce(
            (sum, a) =>
              sum +
              (a.percentage !== undefined
                ? a.percentage
                : a.score || 0),
            0
          ) /
            totalQuizAttempts) *
            10
        ) / 10
      : 0;

  const passedAttempts = attempts.filter((a) =>
    a.passed !== undefined ? a.passed : Boolean(a.isPassed)
  ).length;

  const quizPassRate =
    totalQuizAttempts > 0
      ? Math.round((passedAttempts / totalQuizAttempts) * 1000) / 10
      : 0;

  const quizBreakdown = quizzes.map((quiz) => {
    const qAttempts = attempts.filter(
      (a) => a.quizId.toString() === quiz._id.toString()
    );
    const qAttemptsCount = qAttempts.length;
    const qAvg =
      qAttemptsCount > 0
        ? Math.round(
            (qAttempts.reduce(
              (sum, a) =>
                sum +
                (a.percentage !== undefined
                  ? a.percentage
                  : a.score || 0),
              0
            ) /
              qAttemptsCount) *
              10
          ) / 10
        : 0;
    const qPassed = qAttempts.filter((a) =>
      a.passed !== undefined ? a.passed : Boolean(a.isPassed)
    ).length;
    const qPassRate =
      qAttemptsCount > 0
        ? Math.round((qPassed / qAttemptsCount) * 100)
        : 0;

    return {
      quizId: quiz._id,
      title: quiz.title,
      isPublished: quiz.isPublished,
      questionsCount: quiz.questions?.length || 0,
      passingScore: quiz.passingScore ?? 50,
      attemptsCount: qAttemptsCount,
      averageScore: qAvg,
      passedCount: qPassed,
      passRate: qPassRate,
    };
  });

  // 4. Lecture Progress & Drop-Off
  const modules = await CourseModule.find({ courseId })
    .sort({ orderIndex: 1 })
    .lean();
  const moduleMap = new Map(
    modules.map((m) => [m._id.toString(), m.title])
  );
  const moduleIds = modules.map((m) => m._id);

  const lectures = await Lecture.find({ moduleId: { $in: moduleIds } })
    .sort({ orderIndex: 1 })
    .lean();

  const enrollmentIds = enrollments.map((e) => e._id);
  const lectureProgressList = await LectureProgress.find({
    enrollmentId: { $in: enrollmentIds },
  }).lean();

  let previousLectureCompleted = totalEnrolled;

  const lectureBreakdown = lectures.map((lecture, index) => {
    const lProgress = lectureProgressList.filter(
      (p) => p.lectureId.toString() === lecture._id.toString()
    );

    const startedCount = lProgress.filter(
      (p) => (p.watchedSeconds || 0) > 0 || p.completed
    ).length;
    const completedCount = lProgress.filter((p) => p.completed).length;
    const completionRate =
      totalEnrolled > 0
        ? Math.round((completedCount / totalEnrolled) * 100)
        : 0;
    const startedRate =
      totalEnrolled > 0
        ? Math.round((startedCount / totalEnrolled) * 100)
        : 0;

    const dropOffRate =
      index === 0
        ? 0
        : previousLectureCompleted > 0
        ? Math.max(
            0,
            Math.round(
              ((previousLectureCompleted - startedCount) /
                previousLectureCompleted) *
                100
            )
          )
        : 0;

    previousLectureCompleted = completedCount;

    const totalSecondsWatched = lProgress.reduce(
      (sum, p) => sum + (p.watchedSeconds || 0),
      0
    );
    const avgSecondsWatched =
      startedCount > 0
        ? Math.round(totalSecondsWatched / startedCount)
        : 0;

    return {
      lectureId: lecture._id,
      title: lecture.title,
      moduleId: lecture.moduleId,
      moduleTitle:
        moduleMap.get(lecture.moduleId.toString()) || "Module",
      durationSeconds: lecture.durationSeconds || 0,
      startedCount,
      startedRate,
      completedCount,
      completionRate,
      dropOffRate,
      totalSecondsWatched,
      avgSecondsWatched,
    };
  });

  // 5. Time on Task
  const totalWatchedSeconds = lectureProgressList.reduce(
    (sum, p) => sum + (p.watchedSeconds || 0),
    0
  );
  const avgTimePerStudentSeconds =
    totalEnrolled > 0
      ? Math.round(totalWatchedSeconds / totalEnrolled)
      : 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeStudentsLast7Days = new Set(
    lectureProgressList
      .filter((p) => new Date(p.lastWatchedAt || p.updatedAt) >= sevenDaysAgo)
      .map((p) => p.enrollmentId.toString())
  ).size;

  return {
    course: {
      _id: course._id,
      title: course.title,
      status: course.status,
      category: course.category,
      level: course.level,
      thumbnailUrl: course.thumbnailUrl,
    },
    overview: {
      totalEnrolled,
      completedCount,
      inProgressCount,
      notStartedCount,
      completionRate,
      averageProgress,
      totalQuizzes: quizzes.length,
      totalQuizAttempts,
      averageQuizScore,
      quizPassRate,
      totalLectures: lectures.length,
      totalModules: modules.length,
      totalWatchedSeconds,
      avgTimePerStudentSeconds,
      activeStudentsLast7Days,
    },
    progressDistribution,
    quizBreakdown,
    lectureBreakdown,
    recentEnrollments: enrollments.slice(0, 15).map((e) => ({
      userId: e.userId?._id,
      fullName: e.userId?.fullName || "Anonymous Student",
      email: e.userId?.email || "",
      avatarUrl: e.userId?.avatarUrl || "",
      progressPercent: e.progressPercent || 0,
      enrolledAt: e.enrolledAt,
    })),
  };
};

const getInstructorCoursesAnalytics = async (user) => {
  const query = user.role === "admin" ? {} : { instructorId: user._id };
  const courses = await Course.find(query).sort({ updatedAt: -1 }).lean();

  const courseIds = courses.map((c) => c._id);
  const allEnrollments = await Enrollment.find({
    courseId: { $in: courseIds },
  }).lean();
  const allEnrollmentIds = allEnrollments.map((e) => e._id);

  const allProgress = await LectureProgress.find({
    enrollmentId: { $in: allEnrollmentIds },
  }).lean();

  const allQuizzes = await Quiz.find({
    courseId: { $in: courseIds },
  }).lean();
  const quizIds = allQuizzes.map((q) => q._id);
  const allAttempts = await QuizAttempt.find({
    quizId: { $in: quizIds },
    status: "submitted",
  }).lean();

  const totalEnrollments = allEnrollments.length;
  const completedEnrollments = allEnrollments.filter(
    (e) => (e.progressPercent || 0) >= 100
  ).length;
  const overallCompletionRate =
    totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10
      : 0;

  const overallAvgProgress =
    totalEnrollments > 0
      ? Math.round(
          (allEnrollments.reduce(
            (sum, e) => sum + (e.progressPercent || 0),
            0
          ) /
            totalEnrollments) *
            10
        ) / 10
      : 0;

  const totalAttempts = allAttempts.length;
  const overallAvgQuizScore =
    totalAttempts > 0
      ? Math.round(
          (allAttempts.reduce(
            (sum, a) =>
              sum +
              (a.percentage !== undefined
                ? a.percentage
                : a.score || 0),
            0
          ) /
            totalAttempts) *
            10
        ) / 10
      : 0;

  const totalTimeSeconds = allProgress.reduce(
    (sum, p) => sum + (p.watchedSeconds || 0),
    0
  );
  const avgTimePerLearnerSeconds =
    totalEnrollments > 0
      ? Math.round(totalTimeSeconds / totalEnrollments)
      : 0;

  const coursesAnalytics = courses.map((course) => {
    const cEnrollments = allEnrollments.filter(
      (e) => e.courseId.toString() === course._id.toString()
    );
    const cEnrolledCount = cEnrollments.length;
    const cCompleted = cEnrollments.filter(
      (e) => (e.progressPercent || 0) >= 100
    ).length;
    const cCompletionRate =
      cEnrolledCount > 0
        ? Math.round((cCompleted / cEnrolledCount) * 100)
        : 0;
    const cAvgProgress =
      cEnrolledCount > 0
        ? Math.round(
            (cEnrollments.reduce(
              (s, e) => s + (e.progressPercent || 0),
              0
            ) /
              cEnrolledCount) *
              10
          ) / 10
        : 0;

    const cQuizzes = allQuizzes.filter(
      (q) => q.courseId.toString() === course._id.toString()
    );
    const cQuizIds = new Set(cQuizzes.map((q) => q._id.toString()));
    const cAttempts = allAttempts.filter((a) =>
      cQuizIds.has(a.quizId.toString())
    );
    const cAvgScore =
      cAttempts.length > 0
        ? Math.round(
            (cAttempts.reduce(
              (s, a) =>
                s +
                (a.percentage !== undefined
                  ? a.percentage
                  : a.score || 0),
              0
            ) /
              cAttempts.length) *
              10
          ) / 10
        : 0;

    const cEnrollmentIds = new Set(
      cEnrollments.map((e) => e._id.toString())
    );
    const cProgress = allProgress.filter((p) =>
      cEnrollmentIds.has(p.enrollmentId.toString())
    );
    const cTimeSeconds = cProgress.reduce(
      (s, p) => s + (p.watchedSeconds || 0),
      0
    );

    return {
      courseId: course._id,
      title: course.title,
      status: course.status,
      category: course.category,
      enrolledCount: cEnrolledCount,
      completedCount: cCompleted,
      completionRate: cCompletionRate,
      averageProgress: cAvgProgress,
      averageQuizScore: cAvgScore,
      totalQuizzes: cQuizzes.length,
      totalTimeSeconds: cTimeSeconds,
    };
  });

  return {
    summary: {
      totalCourses: courses.length,
      totalEnrollments,
      completedEnrollments,
      overallCompletionRate,
      overallAvgProgress,
      totalQuizAttempts: totalAttempts,
      overallAvgQuizScore,
      totalTimeSeconds,
      avgTimePerLearnerSeconds,
    },
    courses: coursesAnalytics,
  };
};

module.exports = {
  getCourseAnalytics,
  getInstructorCoursesAnalytics,
};
