const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const http = require("http");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/modules/users/userModel");
const Course = require("../src/modules/courses/courseModel");
const CourseModule = require("../src/modules/courses/moduleModel");
const Lecture = require("../src/modules/courses/lectureModel");
const Quiz = require("../src/modules/quizzes/quizModel");
const QuizAttempt = require("../src/modules/quizzes/quizAttemptModel");
const Enrollment = require("../src/modules/enrollments/enrollmentModel");
const LectureProgress = require("../src/modules/enrollments/lectureProgressModel");
const { generateToken } = require("../src/utils/jwt");

async function runAnalyticsVerification() {
  console.log("Connecting to database for Analytics verification...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Database connected successfully.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Test server running at ${baseUrl}`);

  let instructorOwner, instructorOther, students = [];
  let tokenOwner, tokenOther;
  let testCourse, testModule, lecture1, lecture2, testQuiz;
  let enrollments = [], attempts = [], progresses = [];

  try {
    const ts = Date.now();

    // 1. Setup Instructors
    instructorOwner = await User.create({
      fullName: "Analytics Instructor Alpha",
      email: `inst_alpha_${ts}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenOwner = generateToken(instructorOwner);

    instructorOther = await User.create({
      fullName: "Analytics Instructor Beta",
      email: `inst_beta_${ts}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenOther = generateToken(instructorOther);

    // 2. Setup 4 Students
    for (let i = 1; i <= 4; i++) {
      const student = await User.create({
        fullName: `Analytics Student ${i}`,
        email: `student_${i}_${ts}@example.com`,
        passwordHash: "hash123",
        role: "student",
        isActive: true,
      });
      students.push(student);
    }

    // 3. Setup Course
    testCourse = await Course.create({
      title: `Full-Stack Analytics Course ${ts}`,
      description: "Deep dive into performance analytics",
      category: "Development",
      difficulty: "intermediate",
      price: 999,
      instructorId: instructorOwner._id,
      status: "approved",
      enrolledStudentsCount: 4,
    });

    // 4. Setup Curriculum (Module & 2 Lectures)
    testModule = await CourseModule.create({
      courseId: testCourse._id,
      title: "Module 1: Foundations",
      orderIndex: 1,
    });

    lecture1 = await Lecture.create({
      moduleId: testModule._id,
      title: "Lecture 1: Overview & Architecture",
      durationSeconds: 600,
      orderIndex: 1,
    });

    lecture2 = await Lecture.create({
      moduleId: testModule._id,
      title: "Lecture 2: Advanced Data Pipelines",
      durationSeconds: 900,
      orderIndex: 2,
    });

    // 5. Setup Quiz
    testQuiz = await Quiz.create({
      courseId: testCourse._id,
      createdBy: instructorOwner._id,
      title: "Architecture Mastery Quiz",
      passingScore: 60,
      isPublished: true,
      questions: [
        {
          text: "What is an event-driven queue?",
          type: "mcq",
          points: 1,
          orderIndex: 0,
          options: [
            { text: "PubSub", isCorrect: true },
            { text: "CSS", isCorrect: false }
          ],
        },
        {
          text: "Is Node.js single-threaded in its event loop?",
          type: "mcq",
          points: 1,
          orderIndex: 1,
          options: [
            { text: "True", isCorrect: true },
            { text: "False", isCorrect: false }
          ],
        },
      ],
    });

    // 6. Setup Enrollments:
    // Student 1: 100% progress
    // Student 2: 75% progress
    // Student 3: 25% progress
    // Student 4: 0% progress
    const progressValues = [100, 75, 25, 0];
    for (let i = 0; i < 4; i++) {
      const enr = await Enrollment.create({
        userId: students[i]._id,
        courseId: testCourse._id,
        progressPercent: progressValues[i],
        enrolledAt: new Date(),
      });
      enrollments.push(enr);
    }

    // 7. Setup Lecture Progress
    // Student 1: watched both (600s + 900s)
    progresses.push(await LectureProgress.create({
      enrollmentId: enrollments[0]._id,
      lectureId: lecture1._id,
      watchedSeconds: 600,
      completed: true,
      lastWatchedAt: new Date(),
    }));
    progresses.push(await LectureProgress.create({
      enrollmentId: enrollments[0]._id,
      lectureId: lecture2._id,
      watchedSeconds: 900,
      completed: true,
      lastWatchedAt: new Date(),
    }));

    // Student 2: watched lecture 1 partially (300s)
    progresses.push(await LectureProgress.create({
      enrollmentId: enrollments[1]._id,
      lectureId: lecture1._id,
      watchedSeconds: 300,
      completed: false,
      lastWatchedAt: new Date(),
    }));

    // Student 3: watched lecture 1 minimally (100s)
    progresses.push(await LectureProgress.create({
      enrollmentId: enrollments[2]._id,
      lectureId: lecture1._id,
      watchedSeconds: 100,
      completed: false,
      lastWatchedAt: new Date(),
    }));

    // 8. Setup Quiz Attempts
    // Student 1: scored 80% (passed)
    attempts.push(await QuizAttempt.create({
      quizId: testQuiz._id,
      userId: students[0]._id,
      status: "submitted",
      score: 80,
      percentage: 80,
      passed: true,
    }));

    // Student 2: scored 40% (failed)
    attempts.push(await QuizAttempt.create({
      quizId: testQuiz._id,
      userId: students[1]._id,
      status: "submitted",
      score: 40,
      percentage: 40,
      passed: false,
    }));

    console.log("Mock data fixtures successfully provisioned.");

    // =========================================================================
    // TEST 1: Ownership Security Check
    // =========================================================================
    console.log("\n[TEST 1] Verifying access control / ownership check...");
    const forbiddenRes = await fetch(`${baseUrl}/courses/${testCourse._id}/analytics`, {
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    console.log(`Other instructor status: ${forbiddenRes.status}`);
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthorized instructor, got ${forbiddenRes.status}`);
    }
    console.log("✓ TEST 1 PASSED: Unauthorized instructor blocked with 403 Forbidden.");

    // =========================================================================
    // TEST 2: Owner Course Analytics Retrieval
    // =========================================================================
    console.log("\n[TEST 2] Verifying course analytics for course owner...");
    const ownerRes = await fetch(`${baseUrl}/courses/${testCourse._id}/analytics`, {
      headers: { Authorization: `Bearer ${tokenOwner}` },
    });
    console.log(`Owner request status: ${ownerRes.status}`);
    if (ownerRes.status !== 200) {
      const err = await ownerRes.text();
      throw new Error(`Expected 200 OK, got ${ownerRes.status}: ${err}`);
    }
    const { data } = await ownerRes.json();
    console.log("Analytics overview returned:", JSON.stringify(data.overview, null, 2));

    // A. Enrollment & Completion Rates
    console.log("\n[VERIFY A] Enrollment and completion rates...");
    if (data.overview.totalEnrolled !== 4) {
      throw new Error(`Expected totalEnrolled 4, got ${data.overview.totalEnrolled}`);
    }
    if (data.overview.completedCount !== 1) {
      throw new Error(`Expected completedCount 1, got ${data.overview.completedCount}`);
    }
    if (data.overview.inProgressCount !== 2) {
      throw new Error(`Expected inProgressCount 2, got ${data.overview.inProgressCount}`);
    }
    if (data.overview.notStartedCount !== 1) {
      throw new Error(`Expected notStartedCount 1, got ${data.overview.notStartedCount}`);
    }
    if (data.overview.completionRate !== 25) {
      throw new Error(`Expected completionRate 25%, got ${data.overview.completionRate}`);
    }
    console.log("✓ VERIFY A PASSED: Enrollment and completion rates match expected values.");

    // B. Average Course Progress & Distribution
    console.log("\n[VERIFY B] Average course progress and distribution...");
    if (data.overview.averageProgress !== 50) {
      throw new Error(`Expected averageProgress 50%, got ${data.overview.averageProgress}`);
    }
    console.log("Progress distribution:", data.progressDistribution);
    if (data.progressDistribution.notStarted !== 1) {
      throw new Error(`Expected progressDistribution.notStarted 1, got ${data.progressDistribution.notStarted}`);
    }
    if (data.progressDistribution.low !== 1) { // Student 3 (25%)
      throw new Error(`Expected progressDistribution.low 1, got ${data.progressDistribution.low}`);
    }
    if (data.progressDistribution.high !== 1) { // Student 2 (75%)
      throw new Error(`Expected progressDistribution.high 1, got ${data.progressDistribution.high}`);
    }
    if (data.progressDistribution.completed !== 1) { // Student 1 (100%)
      throw new Error(`Expected progressDistribution.completed 1, got ${data.progressDistribution.completed}`);
    }
    console.log("✓ VERIFY B PASSED: Average course progress and distribution verified.");

    // C. Average Quiz Score from submitted attempts
    console.log("\n[VERIFY C] Average quiz score from submitted attempts...");
    if (data.overview.totalQuizAttempts !== 2) {
      throw new Error(`Expected totalQuizAttempts 2, got ${data.overview.totalQuizAttempts}`);
    }
    if (data.overview.averageQuizScore !== 60) {
      throw new Error(`Expected averageQuizScore 60%, got ${data.overview.averageQuizScore}`);
    }
    if (data.overview.quizPassRate !== 50) {
      throw new Error(`Expected quizPassRate 50%, got ${data.overview.quizPassRate}`);
    }
    console.log("Quiz breakdown array:", data.quizBreakdown);
    if (data.quizBreakdown.length !== 1) {
      throw new Error(`Expected 1 quiz in breakdown, got ${data.quizBreakdown.length}`);
    }
    const qb = data.quizBreakdown[0];
    if (qb.attemptsCount !== 2 || qb.averageScore !== 60 || qb.passRate !== 50) {
      throw new Error(`Quiz breakdown mismatch: ${JSON.stringify(qb)}`);
    }
    console.log("✓ VERIFY C PASSED: Average quiz score and breakdown match.");

    // D. Lecture Progress and Drop-Off
    console.log("\n[VERIFY D] Lecture progress and drop-off funnel...");
    console.log("Lecture breakdown array:", JSON.stringify(data.lectureBreakdown, null, 2));
    if (data.lectureBreakdown.length !== 2) {
      throw new Error(`Expected 2 lectures in breakdown, got ${data.lectureBreakdown.length}`);
    }
    const lec1 = data.lectureBreakdown[0];
    if (lec1.startedCount !== 3 || lec1.completedCount !== 1) {
      throw new Error(`Lecture 1 stats mismatch: started=${lec1.startedCount}, completed=${lec1.completedCount}`);
    }
    const lec2 = data.lectureBreakdown[1];
    if (lec2.startedCount !== 1 || lec2.completedCount !== 1) {
      throw new Error(`Lecture 2 stats mismatch: started=${lec2.startedCount}, completed=${lec2.completedCount}`);
    }
    console.log("✓ VERIFY D PASSED: Sequential lecture progress and retention drop-off verified.");

    // E. Time-on-Task
    console.log("\n[VERIFY E] Time-on-task metrics...");
    // Total watched seconds: 600 + 900 + 300 + 100 = 1900
    if (data.overview.totalWatchedSeconds !== 1900) {
      throw new Error(`Expected totalWatchedSeconds 1900, got ${data.overview.totalWatchedSeconds}`);
    }
    // Average time per student: 1900 / 4 = 475
    if (data.overview.avgTimePerStudentSeconds !== 475) {
      throw new Error(`Expected avgTimePerStudentSeconds 475, got ${data.overview.avgTimePerStudentSeconds}`);
    }
    if (data.overview.activeStudentsLast7Days !== 3) {
      throw new Error(`Expected activeStudentsLast7Days 3, got ${data.overview.activeStudentsLast7Days}`);
    }
    console.log("✓ VERIFY E PASSED: Time-on-task (total, per-student, active learners) verified.");

    // =========================================================================
    // TEST 3: Aggregate Instructor Analytics (GET /api/v1/courses/mine/analytics)
    // =========================================================================
    console.log("\n[TEST 3] Verifying instructor studio aggregate analytics...");
    const studioRes = await fetch(`${baseUrl}/courses/mine/analytics`, {
      headers: { Authorization: `Bearer ${tokenOwner}` },
    });
    if (studioRes.status !== 200) {
      const err = await studioRes.text();
      throw new Error(`Expected 200 OK for mine/analytics, got ${studioRes.status}: ${err}`);
    }
    const studioData = await studioRes.json();
    console.log("Studio aggregate data overview:", studioData.data.summary);
    if (studioData.data.summary.totalCourses < 1) {
      throw new Error("Expected at least 1 course in studio summary");
    }
    if (studioData.data.summary.totalEnrollments !== 4) {
      throw new Error(`Expected totalEnrollments 4 in studio summary, got ${studioData.data.summary.totalEnrollments}`);
    }
    console.log("✓ TEST 3 PASSED: Instructor studio aggregate analytics verified.");

    console.log("\n=======================================================");
    console.log("🎉 ALL INSTRUCTOR DETAILED ANALYTICS TESTS PASSED! ✓");
    console.log("=======================================================\n");

  } finally {
    // Cleanup
    console.log("Cleaning up test data...");
    if (progresses.length) {
      await LectureProgress.deleteMany({ _id: { $in: progresses.map((p) => p._id) } });
    }
    if (attempts.length) {
      await QuizAttempt.deleteMany({ _id: { $in: attempts.map((a) => a._id) } });
    }
    if (enrollments.length) {
      await Enrollment.deleteMany({ _id: { $in: enrollments.map((e) => e._id) } });
    }
    if (testQuiz) await Quiz.deleteOne({ _id: testQuiz._id });
    if (lecture1) await Lecture.deleteOne({ _id: lecture1._id });
    if (lecture2) await Lecture.deleteOne({ _id: lecture2._id });
    if (testModule) await CourseModule.deleteOne({ _id: testModule._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (instructorOwner) await User.deleteOne({ _id: instructorOwner._id });
    if (instructorOther) await User.deleteOne({ _id: instructorOther._id });
    if (students.length) {
      await User.deleteMany({ _id: { $in: students.map((s) => s._id) } });
    }
    await server.close();
    await mongoose.disconnect();
    console.log("Cleanup complete and server closed.");
  }
}

runAnalyticsVerification().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
