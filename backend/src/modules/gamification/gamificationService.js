const mongoose = require("mongoose");
const Course = require("../courses/courseModel");
const Enrollment = require("../enrollments/enrollmentModel");
const LectureProgress = require("../enrollments/lectureProgressModel");
const QuizAttempt = require("../quizzes/quizAttemptModel");
const Submission = require("../assignments/submissionModel");
const Certificate = require("../certificates/certificateModel");

/**
 * Calculate user study streak based on real activity timestamps
 */
const getMyStreak = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  // Collect activity dates from lecture progress, quiz attempts, and assignment submissions
  const [progDates, quizDates, subDates] = await Promise.all([
    LectureProgress.find({ userId: uid }).select("updatedAt createdAt").lean(),
    QuizAttempt.find({ userId: uid, status: "submitted" }).select("submittedAt createdAt").lean(),
    Submission.find({ userId: uid }).select("submittedAt createdAt").lean(),
  ]);

  const rawDates = [
    ...progDates.map((p) => p.updatedAt || p.createdAt),
    ...quizDates.map((q) => q.submittedAt || q.createdAt),
    ...subDates.map((s) => s.submittedAt || s.createdAt),
  ].filter(Boolean);

  if (rawDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
    };
  }

  // Convert to unique YYYY-MM-DD date strings sorted descending
  const dateSet = new Set(
    rawDates.map((d) => new Date(d).toISOString().split("T")[0])
  );
  const sortedDates = Array.from(dateSet).sort().reverse();

  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  const isActiveToday = sortedDates.includes(todayStr);
  const isActiveYesterday = sortedDates.includes(yesterdayStr);

  let currentStreak = 0;
  if (isActiveToday || isActiveYesterday) {
    let checkDate = new Date(isActiveToday ? todayStr : yesterdayStr);
    while (true) {
      const checkStr = checkDate.toISOString().split("T")[0];
      if (dateSet.has(checkStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak historically
  let longestStreak = currentStreak;
  let tempStreak = 0;
  let prevDate = null;

  // Iterate oldest to newest
  const ascDates = Array.from(dateSet).sort();
  for (const dStr of ascDates) {
    const d = new Date(dStr);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = d;
  }

  return {
    currentStreak: Math.max(currentStreak, isActiveToday ? 1 : 0),
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveDate: sortedDates[0] || null,
    isActiveToday,
    activityCount: rawDates.length,
  };
};

/**
 * Dynamically evaluate student badges and milestones
 */
const getMyBadges = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const [certificates, quizAttempts, submissions, completedLectures, streakData] =
    await Promise.all([
      Certificate.find({ userId: uid }).lean(),
      QuizAttempt.find({ userId: uid, status: "submitted" }).lean(),
      Submission.find({ userId: uid }).lean(),
      LectureProgress.countDocuments({ userId: uid, completed: true }),
      getMyStreak(userId),
    ]);

  const hasPerfectScore = quizAttempts.some(
    (a) => a.percentage === 100 || (a.score && a.maxScore && a.score === a.maxScore)
  );
  const hasPassedQuiz = quizAttempts.some((a) => (a.percentage || 0) >= 50);

  const badgeDefinitions = [
    {
      id: "century_club",
      name: "Century Club",
      category: "Mastery",
      description: "Complete a course with 100% curriculum progress and claim your official certificate.",
      icon: "🎓",
      isEarned: certificates.length > 0,
      earnedAt: certificates[0]?.issuedAt || null,
      progress: certificates.length > 0 ? "1/1 Earned" : "0/1 Courses Completed",
    },
    {
      id: "quiz_perfect_score",
      name: "Quiz Mastermind",
      category: "Assessment",
      description: "Achieve a flawless 100% score on any course quiz assessment.",
      icon: "⚡",
      isEarned: hasPerfectScore,
      earnedAt: quizAttempts.find((a) => a.percentage === 100)?.submittedAt || null,
      progress: hasPerfectScore ? "100% Score" : "Max score needed: 100%",
    },
    {
      id: "first_quiz_passed",
      name: "Knowledge Seeker",
      category: "Assessment",
      description: "Successfully pass your first course quiz assessment with a passing grade.",
      icon: "💡",
      isEarned: hasPassedQuiz,
      earnedAt: quizAttempts.find((a) => (a.percentage || 0) >= 50)?.submittedAt || null,
      progress: hasPassedQuiz ? "Quiz Passed" : "Take a quiz to unlock",
    },
    {
      id: "assignment_ace",
      name: "Hands-On Builder",
      category: "Projects",
      description: "Submit a practical project assignment to demonstrate real-world skills.",
      icon: "🛠",
      isEarned: submissions.length > 0,
      earnedAt: submissions[0]?.submittedAt || submissions[0]?.createdAt || null,
      progress: submissions.length > 0 ? `${submissions.length} Project(s)` : "Submit 1 assignment",
    },
    {
      id: "deep_diver",
      name: "Deep Diver",
      category: "Learning",
      description: "Complete 10 or more video lectures across your enrolled courses.",
      icon: "📚",
      isEarned: completedLectures >= 10,
      earnedAt: completedLectures >= 10 ? new Date() : null,
      progress: `${Math.min(completedLectures, 10)}/10 Lectures`,
    },
    {
      id: "streak_scholar",
      name: "Dedicated Scholar",
      category: "Consistency",
      description: "Maintain a study streak of 3 or more consecutive active days.",
      icon: "🔥",
      isEarned: (streakData.longestStreak || 0) >= 3,
      earnedAt: (streakData.longestStreak || 0) >= 3 ? new Date() : null,
      progress: `${streakData.currentStreak || 0}/3 Days Streak`,
    },
  ];

  const earnedCount = badgeDefinitions.filter((b) => b.isEarned).length;

  return {
    totalCount: badgeDefinitions.length,
    earnedCount,
    badges: badgeDefinitions,
  };
};

/**
 * Recommend courses based on student enrollments, interests, and ratings
 */
const getMyRecommendations = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  // 1. Get user enrollments
  const enrollments = await Enrollment.find({ userId: uid }).select("courseId").lean();
  const enrolledCourseIds = enrollments.map((e) => e.courseId.toString());

  // 2. Find approved courses user is NOT yet enrolled in
  const availableCourses = await Course.find({
    status: "approved",
    _id: { $nin: enrolledCourseIds },
  })
    .populate("instructorId", "fullName email")
    .lean();

  if (availableCourses.length === 0) {
    return { count: 0, recommendations: [] };
  }

  // 3. Determine categories user has shown interest in
  const enrolledCourses = await Course.find({ _id: { $in: enrolledCourseIds } })
    .select("category")
    .lean();
  const preferredCategories = new Set(enrolledCourses.map((c) => c.category).filter(Boolean));

  // 4. Rank and generate recommendations
  const recommendations = availableCourses.map((course) => {
    let matchScore = 75;
    let reason = "Popular course trending among students";

    if (preferredCategories.has(course.category)) {
      matchScore = 95;
      reason = `Based on your interest in ${course.category}`;
    } else if (course.level === "beginner") {
      matchScore = 85;
      reason = "Great foundational course to expand your developer skill set";
    }

    return {
      _id: course._id,
      title: course.title,
      description: course.description,
      category: course.category || "Development",
      level: course.level || "Beginner",
      thumbnailUrl: course.thumbnailUrl,
      instructor: course.instructorId ? { fullName: course.instructorId.fullName } : null,
      matchScore,
      reason,
    };
  });

  // Sort descending by matchScore
  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  return {
    count: recommendations.length,
    recommendations: recommendations.slice(0, 6),
  };
};

module.exports = {
  getMyStreak,
  getMyBadges,
  getMyRecommendations,
};

