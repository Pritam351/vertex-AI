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
const Assignment = require("../src/modules/assignments/assignmentModel");
const Submission = require("../src/modules/assignments/submissionModel");
const Enrollment = require("../src/modules/enrollments/enrollmentModel");
const { generateToken } = require("../src/utils/jwt");

async function runDashboardTests() {
  console.log("Connecting to database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Database connected.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Test server running at ${baseUrl}`);

  let instructorA, instructorB, studentUser, tokenA, tokenB, tokenStudent;
  let coursePending, courseApproved, courseRejected;
  let testModule, testLecture, liveQuiz, draftQuiz, testAssignment, testSubmission, testEnrollment;

  try {
    const timestamp = Date.now();

    // 1. Setup users
    instructorA = await User.create({
      fullName: "Instructor Diana",
      email: `inst_diana_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenA = generateToken(instructorA);

    instructorB = await User.create({
      fullName: "Instructor Evan",
      email: `inst_evan_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenB = generateToken(instructorB);

    studentUser = await User.create({
      fullName: "Student Charlie",
      email: `student_charlie_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "student",
      isActive: true,
    });
    tokenStudent = generateToken(studentUser);

    console.log("✓ Created Instructor A, Instructor B, and Student");

    // 2. Create courses for Instructor A with different statuses
    courseApproved = await Course.create({
      title: `NodeJS Mastery ${timestamp}`,
      description: "Comprehensive backend course",
      category: "Development",
      difficulty: "intermediate",
      price: 499,
      instructorId: instructorA._id,
      status: "approved",
    });

    coursePending = await Course.create({
      title: `FastAPI Basics ${timestamp}`,
      description: "Python async framework",
      category: "Development",
      difficulty: "beginner",
      price: 0,
      instructorId: instructorA._id,
      status: "pending",
    });

    courseRejected = await Course.create({
      title: `Outdated Tech ${timestamp}`,
      description: "Needs revision",
      category: "Development",
      difficulty: "advanced",
      price: 199,
      instructorId: instructorA._id,
      status: "rejected",
    });

    console.log("✓ Created Approved, Pending, and Rejected courses for Instructor A");

    // 3. Enroll student in Approved course
    testEnrollment = await Enrollment.create({
      userId: studentUser._id,
      courseId: courseApproved._id,
      enrolledAt: new Date(),
      progress: 25,
      completedLectures: [],
    });
    console.log("✓ Enrolled Student Charlie into courseApproved");

    // 4. Create Module & Lecture in Approved course
    testModule = await CourseModule.create({
      courseId: courseApproved._id,
      title: "Module 1: Introduction",
      orderIndex: 1,
    });

    testLecture = await Lecture.create({
      moduleId: testModule._id,
      title: "Lecture 1.1: Architecture",
      videoUrl: "https://example.com/arch.mp4",
      durationSeconds: 300,
      transcript: "Welcome to Node architecture.",
      orderIndex: 1,
    });
    console.log("✓ Created Module and Lecture in Approved course");

    // 5. Create Live quiz and Draft quiz in Approved course
    liveQuiz = await Quiz.create({
      courseId: courseApproved._id,
      title: "Quiz 1: Architecture Check",
      passingScore: 70,
      isPublished: true,
      createdBy: instructorA._id,
      questions: [
        {
          text: "What engine powers Node.js?",
          type: "mcq",
          options: [
            { text: "V8", isCorrect: true },
            { text: "SpiderMonkey", isCorrect: false },
            { text: "Chakra", isCorrect: false },
          ],
          points: 10,
          orderIndex: 0,
        },
      ],
    });

    draftQuiz = await Quiz.create({
      courseId: courseApproved._id,
      title: "Quiz 2: Advanced Streams (Draft)",
      passingScore: 80,
      isPublished: false,
      createdBy: instructorA._id,
      questions: [
        {
          text: "Which stream type is readable and writable?",
          type: "mcq",
          options: [
            { text: "Duplex", isCorrect: true },
            { text: "Readable", isCorrect: false },
            { text: "Writable", isCorrect: false },
          ],
          points: 10,
          orderIndex: 0,
        },
      ],
    });
    console.log("✓ Created 1 Live Quiz (published: true) and 1 Draft Quiz (published: false)");

    // 6. Create Assignment in Approved course
    testAssignment = await Assignment.create({
      courseId: courseApproved._id,
      title: "Assignment 1: Build an Express API",
      instructions: "Submit GitHub repo link with clean architecture",
      dueDate: new Date(Date.now() + 7 * 86400000),
      maxScore: 100,
      createdBy: instructorA._id,
    });
    console.log("✓ Created Assignment in Approved course");

    // -------------------------------------------------------------------------
    // TEST 1: GET /courses/mine - Total courses counts by Pending / Approved / Rejected status & Enrolled count
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: GET /courses/mine with enrolledStudentsCount & status breakdown ---");
    const mineRes = await fetch(`${baseUrl}/courses/mine`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const mineData = await mineRes.json();
    if (!mineData.success || !Array.isArray(mineData.data?.courses)) {
      throw new Error(`GET /courses/mine failed: ${JSON.stringify(mineData)}`);
    }

    const courses = mineData.data.courses;
    const foundApproved = courses.find((c) => c._id.toString() === courseApproved._id.toString());
    const foundPending = courses.find((c) => c._id.toString() === coursePending._id.toString());
    const foundRejected = courses.find((c) => c._id.toString() === courseRejected._id.toString());

    if (!foundApproved || foundApproved.status !== "approved") throw new Error("Approved course status mismatch");
    if (!foundPending || foundPending.status !== "pending") throw new Error("Pending course status mismatch");
    if (!foundRejected || foundRejected.status !== "rejected") throw new Error("Rejected course status mismatch");
    if (foundApproved.enrolledStudentsCount !== 1) {
      throw new Error(`Expected enrolledStudentsCount = 1 for approved course, got ${foundApproved.enrolledStudentsCount}`);
    }
    console.log(`✓ GET /courses/mine verified! Total: ${courses.length}, Approved: ${foundApproved.title} (Enrolled: ${foundApproved.enrolledStudentsCount}), Pending: ${foundPending.title}, Rejected: ${foundRejected.title}`);

    // -------------------------------------------------------------------------
    // TEST 2: GET /courses/:courseId/modules - Module and lecture counts
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: GET /courses/:courseId/modules ---");
    const modRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/modules`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const modData = await modRes.json();
    if (!modData.success || !Array.isArray(modData.data?.modules)) {
      throw new Error(`GET /courses/:courseId/modules failed: ${JSON.stringify(modData)}`);
    }
    const modules = modData.data.modules;
    const lecturesCount = modules.reduce((sum, m) => sum + (m.lectures?.length || 0), 0);
    if (modules.length !== 1 || lecturesCount !== 1) {
      throw new Error(`Expected 1 module and 1 lecture, got ${modules.length} modules, ${lecturesCount} lectures`);
    }
    console.log(`✓ Modules & lectures verified! Count: ${modules.length} module, ${lecturesCount} lecture`);

    // -------------------------------------------------------------------------
    // TEST 3: GET /courses/:courseId/quizzes - Quiz counts Live and drafts
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: GET /courses/:courseId/quizzes (Live vs Drafts) ---");
    const quizRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/quizzes`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const quizData = await quizRes.json();
    if (!quizData.success || !Array.isArray(quizData.data?.quizzes)) {
      throw new Error(`GET /courses/:courseId/quizzes failed: ${JSON.stringify(quizData)}`);
    }
    const quizzes = quizData.data.quizzes;
    const liveQuizzes = quizzes.filter((q) => q.isPublished === true);
    const draftQuizzes = quizzes.filter((q) => q.isPublished === false);
    if (liveQuizzes.length !== 1 || draftQuizzes.length !== 1) {
      throw new Error(`Expected 1 live and 1 draft quiz, got ${liveQuizzes.length} live, ${draftQuizzes.length} draft`);
    }
    console.log(`✓ Quizzes verified! Live: ${liveQuizzes.length}, Drafts: ${draftQuizzes.length}, Total: ${quizzes.length}`);

    // -------------------------------------------------------------------------
    // TEST 4: GET /courses/:courseId/assignments - Assignment counts & list
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: GET /courses/:courseId/assignments ---");
    const assignRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/assignments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const assignData = await assignRes.json();
    if (!assignData.success || !Array.isArray(assignData.data?.assignments)) {
      throw new Error(`GET /courses/:courseId/assignments failed: ${JSON.stringify(assignData)}`);
    }
    const assignments = assignData.data.assignments;
    if (assignments.length !== 1 || assignments[0].title !== testAssignment.title) {
      throw new Error(`Expected 1 assignment, got ${assignments.length}`);
    }
    console.log(`✓ Assignments verified! Found ${assignments.length} assignment: "${assignments[0].title}"`);

    // -------------------------------------------------------------------------
    // TEST 5: GET /courses/:courseId/enrollments - Enrolled students per course
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: GET /courses/:courseId/enrollments ---");
    const enrollRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/enrollments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const enrollData = await enrollRes.json();
    if (!enrollData.success || !Array.isArray(enrollData.data?.enrollments)) {
      throw new Error(`GET /courses/:courseId/enrollments failed: ${JSON.stringify(enrollData)}`);
    }
    const enrollments = enrollData.data.enrollments;
    if (enrollments.length !== 1 || enrollments[0].userId?.email !== studentUser.email) {
      throw new Error(`Expected enrolled student ${studentUser.email}, got: ${JSON.stringify(enrollments)}`);
    }
    console.log(`✓ Enrolled students verified! Enrolled: "${enrollments[0].userId.fullName}" (${enrollments[0].userId.email}), progress: ${enrollments[0].progress}%`);

    // -------------------------------------------------------------------------
    // TEST 6: Unauthorized instructor cannot access another instructor's enrollments
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Security - Instructor B accessing Instructor A's enrollments ---");
    const enrollForbiddenRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/enrollments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (enrollForbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthorized instructor, got ${enrollForbiddenRes.status}`);
    }
    console.log("✓ Access control verified: Instructor B received 403 Forbidden when trying to access Instructor A's course enrollments");

    // -------------------------------------------------------------------------
    // TEST 7: Student submits assignment work
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: POST /assignments/:id/submit - Student submits work ---");
    const submitRes = await fetch(`${baseUrl}/assignments/${testAssignment._id}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenStudent}`,
      },
      body: JSON.stringify({
        fileUrl: "https://github.com/charlie/express-api-submission",
      }),
    });
    const submitData = await submitRes.json();
    if (!submitData.success || !submitData.data?.submission) {
      throw new Error(`Submission failed: ${JSON.stringify(submitData)}`);
    }
    testSubmission = submitData.data.submission;
    console.log(`✓ Assignment submitted by student! Submission ID: ${testSubmission._id}, fileUrl: ${testSubmission.fileUrl}`);

    // -------------------------------------------------------------------------
    // TEST 8: GET /courses/:courseId/submissions - List submissions with student, assignment, date, status, work
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: GET /courses/:courseId/submissions (Student, Assignment, Date, Status, Work) ---");
    const listSubRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listSubData = await listSubRes.json();
    if (!listSubData.success || !Array.isArray(listSubData.data?.submissions)) {
      throw new Error(`GET /courses/:courseId/submissions failed: ${JSON.stringify(listSubData)}`);
    }
    const submissions = listSubData.data.submissions;
    if (submissions.length !== 1) {
      throw new Error(`Expected 1 submission, got ${submissions.length}`);
    }
    const sub = submissions[0];
    if (!sub.userId?.fullName || !sub.assignmentId?.title || !sub.fileUrl) {
      throw new Error(`Missing populated fields in submission: ${JSON.stringify(sub)}`);
    }
    const initialStatus = sub.grade !== null && sub.grade !== undefined ? "graded" : "pending";
    if (initialStatus !== "pending") {
      throw new Error(`Expected initial submission status to be pending, got ${initialStatus}`);
    }
    console.log(`✓ Submissions list verified!
      Student: ${sub.userId.fullName} (${sub.userId.email})
      Assignment: ${sub.assignmentId.title}
      Date: ${sub.submittedAt || sub.createdAt}
      Status: ${initialStatus}
      Submitted work: ${sub.fileUrl}`);

    // -------------------------------------------------------------------------
    // TEST 9: Security - Instructor B cannot view or grade Instructor A's submissions
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Security - Instructor B accessing submissions ---");
    const subForbiddenRes = await fetch(`${baseUrl}/courses/${courseApproved._id}/submissions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (subForbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthorized instructor, got ${subForbiddenRes.status}`);
    }
    const gradeForbiddenRes = await fetch(`${baseUrl}/submissions/${testSubmission._id}/grade`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ grade: 50, feedback: "Hacked" }),
    });
    if (gradeForbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when grading another instructor's course submission, got ${gradeForbiddenRes.status}`);
    }
    console.log("✓ Access control verified: Instructor B cannot view or grade Instructor A's submissions (403 Forbidden)");

    // -------------------------------------------------------------------------
    // TEST 10: PUT /submissions/:id/grade - Instructor grades submission
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: PUT /submissions/:id/grade - Grade submission ---");
    const gradeRes = await fetch(`${baseUrl}/submissions/${testSubmission._id}/grade`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        grade: 95,
        feedback: "Outstanding work on the API routes and error handling!",
      }),
    });
    const gradeData = await gradeRes.json();
    if (!gradeData.success || !gradeData.data?.submission) {
      throw new Error(`Grading failed: ${JSON.stringify(gradeData)}`);
    }
    const gradedSub = gradeData.data.submission;
    if (gradedSub.grade !== 95 || gradedSub.feedback !== "Outstanding work on the API routes and error handling!") {
      throw new Error(`Grade or feedback mismatch: ${JSON.stringify(gradedSub)}`);
    }

    // Verify submission status in listing now shows graded
    const listSubRes2 = await fetch(`${baseUrl}/courses/${courseApproved._id}/submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listSubData2 = await listSubRes2.json();
    const updatedSubInList = listSubData2.data.submissions.find((s) => s._id.toString() === testSubmission._id.toString());
    if (updatedSubInList.grade !== 95) {
      throw new Error(`Updated submission in list did not reflect grade 95: ${JSON.stringify(updatedSubInList)}`);
    }
    console.log(`✓ Submission graded successfully! Grade: ${gradedSub.grade}/100, Feedback: "${gradedSub.feedback}"`);
    console.log(`✓ Verified updated status in course submissions list: Graded: ${updatedSubInList.grade}/100`);

    console.log("\n=======================================================");
    console.log("🎉 ALL INSTRUCTOR DASHBOARD TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("=======================================================\n");
  } finally {
    // Cleanup created test records
    console.log("Cleaning up test records...");
    if (testSubmission) await Submission.findByIdAndDelete(testSubmission._id);
    if (testAssignment) await Assignment.findByIdAndDelete(testAssignment._id);
    if (liveQuiz) await Quiz.findByIdAndDelete(liveQuiz._id);
    if (draftQuiz) await Quiz.findByIdAndDelete(draftQuiz._id);
    if (testLecture) await Lecture.findByIdAndDelete(testLecture._id);
    if (testModule) await CourseModule.findByIdAndDelete(testModule._id);
    if (testEnrollment) await Enrollment.findByIdAndDelete(testEnrollment._id);
    if (courseApproved) await Course.findByIdAndDelete(courseApproved._id);
    if (coursePending) await Course.findByIdAndDelete(coursePending._id);
    if (courseRejected) await Course.findByIdAndDelete(courseRejected._id);
    if (instructorA) await User.findByIdAndDelete(instructorA._id);
    if (instructorB) await User.findByIdAndDelete(instructorB._id);
    if (studentUser) await User.findByIdAndDelete(studentUser._id);
    console.log("✓ Cleanup complete.");

    server.close();
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

runDashboardTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
