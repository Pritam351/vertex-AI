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
const TranscriptChunk = require("../src/ai/transcriptChunkModel");
const Enrollment = require("../src/modules/enrollments/enrollmentModel");
const { generateToken } = require("../src/utils/jwt");

async function runTests() {
  console.log("=== AI Quiz Generation & Workflow Verification ===");
  console.log("Connecting to database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Database connected.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Test server running at ${baseUrl}`);

  let instructorA, instructorB, studentUser, adminUser;
  let tokenA, tokenB, tokenStudent, tokenAdmin;
  let testCourse, testModule, testLecture, generatedQuiz, testAttempt;

  try {
    const timestamp = Date.now();

    // 1. Setup users
    instructorA = await User.create({
      fullName: "Instructor Alice",
      email: `inst_alice_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenA = generateToken(instructorA);

    instructorB = await User.create({
      fullName: "Instructor Bob",
      email: `inst_bob_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenB = generateToken(instructorB);

    studentUser = await User.create({
      fullName: "Student Sam",
      email: `student_sam_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "student",
      isActive: true,
    });
    tokenStudent = generateToken(studentUser);

    adminUser = await User.create({
      fullName: "Admin Alex",
      email: `admin_alex_${timestamp}@example.com`,
      passwordHash: "hash123",
      role: "admin",
      isActive: true,
    });
    tokenAdmin = generateToken(adminUser);

    console.log("✓ Test users created (Instructor A, Instructor B, Student, Admin)");

    // 2. Create pending course, module, and lecture with transcript
    testCourse = await Course.create({
      title: `Deep Learning Fundamentals ${timestamp}`,
      description: "Comprehensive introduction to artificial neural networks and deep learning.",
      instructorId: instructorA._id,
      category: "Computer Science",
      level: "intermediate",
      price: 0,
      status: "pending", // Pending course!
    });

    testModule = await CourseModule.create({
      courseId: testCourse._id,
      title: "Module 1: Foundations of Neural Networks",
      orderIndex: 1,
    });

    const richTranscript = `
      Welcome to this lecture on Neural Networks.
      Artificial neural networks are computational models inspired by biological neural networks.
      An individual artificial neuron receives multiple inputs, weights them accordingly, adds a bias term,
      and applies an activation function such as ReLU, Sigmoid, or Tanh to produce an output.
      Non-linear activation functions are critical because they enable neural networks to learn non-linear patterns.
      During the training phase, gradient descent combined with the backpropagation algorithm is used
      to compute the gradient of the loss function with respect to each weight and adjust the network parameters.
      Overfitting occurs when a model performs exceptionally well on training data but poorly on unseen test data.
      Techniques like dropout, L2 regularization, and early stopping are widely employed to prevent overfitting.
    `.trim();

    testLecture = await Lecture.create({
      moduleId: testModule._id,
      title: "Introduction to Artificial Neurons and Activation Functions",
      videoUrl: "https://example.com/videos/neural-networks.mp4",
      transcript: richTranscript,
      orderIndex: 1,
      isFreePreview: false,
    });

    console.log("✓ Created pending course, module, and lecture with transcript content.");

    // Helper for HTTP requests
    async function apiRequest(endpoint, options = {}, token = null) {
      const url = `${baseUrl}${endpoint}`;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      };

      const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await res.json().catch(() => null);
      return { status: res.status, ok: res.ok, data };
    }

    // 3. Test Ingest Lecture Transcript
    console.log("\n--- Testing Ingestion: POST /ai/lectures/:id/ingest ---");
    const ingestRes = await apiRequest(
      `/ai/lectures/${testLecture._id}/ingest`,
      { method: "POST" },
      tokenA
    );
    console.log(`Ingest Status: ${ingestRes.status}`);
    if (ingestRes.status !== 200) {
      throw new Error(`Ingest failed: ${JSON.stringify(ingestRes.data)}`);
    }
    const chunkCount = await TranscriptChunk.countDocuments({ lectureId: testLecture._id });
    console.log(`✓ Ingested transcript into ${chunkCount} TranscriptChunk documents.`);

    // 4. Test AI Quiz Generation on PENDING course by Instructor A
    console.log("\n--- Testing AI Quiz Generation on PENDING Course (Instructor A) ---");
    const genRes = await apiRequest(
      `/ai/lectures/${testLecture._id}/generate-quiz`,
      {
        method: "POST",
        body: { questionCount: 5 },
      },
      tokenA
    );
    console.log(`Generate Quiz Status: ${genRes.status}`);
    if (genRes.status !== 201) {
      throw new Error(`Quiz generation failed: ${JSON.stringify(genRes.data)}`);
    }
    if (!genRes.data.quizId || !Array.isArray(genRes.data.questions)) {
      throw new Error(`Invalid response structure: ${JSON.stringify(genRes.data)}`);
    }
    console.log(`✓ AI Quiz generated successfully on PENDING course! Quiz ID: ${genRes.data.quizId}`);
    console.log(`  Title: "${genRes.data.title}"`);
    console.log(`  Questions generated: ${genRes.data.questions.length}`);
    console.log(`  isPublished: ${genRes.data.isPublished} (Saved as Draft)`);
    generatedQuiz = genRes.data.quiz;

    // 5. Test Ownership Enforcement: Instructor B must receive 403 Forbidden
    console.log("\n--- Testing Ownership Restriction: Instructor B Generating Quiz on Instructor A's Course ---");
    const genForbiddenRes = await apiRequest(
      `/ai/lectures/${testLecture._id}/generate-quiz`,
      {
        method: "POST",
        body: { questionCount: 5 },
      },
      tokenB
    );
    console.log(`Instructor B Generate Status: ${genForbiddenRes.status}`);
    if (genForbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Instructor B, got: ${genForbiddenRes.status}`);
    }
    console.log(`✓ Access correctly denied to Instructor B (403 Forbidden): "${genForbiddenRes.data.message}"`);

    // 6. Test Review and Edit Quiz: PUT /quizzes/:id as Instructor A
    console.log("\n--- Testing Quiz Review & Editing: PUT /quizzes/:id ---");
    const updatedTitle = `Reviewed AI Quiz: Neural Networks & Deep Learning`;
    const editPayload = {
      title: updatedTitle,
      instructions: "Reviewed and edited by Instructor Alice for exam preparation.",
      passingScore: 70,
      timeLimitMinutes: 25,
      questions: generatedQuiz.questions.map((q, idx) => ({
        text: `[Q${idx + 1}] ${q.text}`,
        type: q.type,
        options: q.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
        points: 2,
        orderIndex: idx,
      })),
    };

    const editRes = await apiRequest(
      `/quizzes/${generatedQuiz._id}`,
      {
        method: "PUT",
        body: editPayload,
      },
      tokenA
    );
    console.log(`Edit Quiz Status: ${editRes.status}`);
    if (editRes.status !== 200 || editRes.data?.data?.quiz?.title !== updatedTitle) {
      throw new Error(`Quiz edit failed: ${JSON.stringify(editRes.data)}`);
    }
    console.log(`✓ Quiz edited and saved: title="${editRes.data.data.quiz.title}", passScore=${editRes.data.data.quiz.passingScore}%`);

    // 7. Test Instructor B cannot edit Instructor A's quiz
    console.log("\n--- Testing Quiz Edit Ownership: Instructor B attempting to edit Instructor A's Quiz ---");
    const editForbiddenRes = await apiRequest(
      `/quizzes/${generatedQuiz._id}`,
      {
        method: "PUT",
        body: { title: "Hacked title" },
      },
      tokenB
    );
    console.log(`Instructor B Edit Status: ${editForbiddenRes.status}`);
    if (editForbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Instructor B editing quiz, got: ${editForbiddenRes.status}`);
    }
    console.log("✓ Quiz edit correctly blocked with 403 for Instructor B.");

    // 8. Test Publish Quiz: PATCH /quizzes/:id/publish
    console.log("\n--- Testing Publish Quiz: PATCH /quizzes/:id/publish ---");
    const publishRes = await apiRequest(
      `/quizzes/${generatedQuiz._id}/publish`,
      { method: "PATCH" },
      tokenA
    );
    console.log(`Publish Status: ${publishRes.status}`);
    if (publishRes.status !== 200 || !publishRes.data?.data?.quiz?.isPublished) {
      throw new Error(`Quiz publish failed: ${JSON.stringify(publishRes.data)}`);
    }
    console.log(`✓ Quiz published successfully: isPublished=${publishRes.data.data.quiz.isPublished}`);

    // 9. Approve Course & Enroll Student
    console.log("\n--- Approving Course and Enrolling Student ---");
    await Course.findByIdAndUpdate(testCourse._id, { status: "approved" });

    const enrollRes = await apiRequest(
      `/courses/${testCourse._id}/enroll`,
      { method: "POST" },
      tokenStudent
    );
    console.log(`Enrollment Status: ${enrollRes.status}`);
    if (enrollRes.status !== 201) {
      throw new Error(`Enrollment failed: ${JSON.stringify(enrollRes.data)}`);
    }
    console.log("✓ Student enrolled in course.");

    // 10. Student Lists Published Quizzes
    console.log("\n--- Student Viewing Course Quizzes: GET /courses/:id/quizzes ---");
    const listQuizzesRes = await apiRequest(
      `/courses/${testCourse._id}/quizzes`,
      {},
      tokenStudent
    );
    console.log(`List Quizzes Status: ${listQuizzesRes.status}`);
    const availableQuizzes = listQuizzesRes.data?.data?.quizzes || [];
    if (!availableQuizzes.some((q) => q._id.toString() === generatedQuiz._id.toString())) {
      throw new Error(`Published quiz not found in student quiz list: ${JSON.stringify(listQuizzesRes.data)}`);
    }
    console.log(`✓ Student successfully sees published quiz: "${availableQuizzes[0].title}"`);

    // 11. Student Starts Attempt: POST /quizzes/:id/attempt
    console.log("\n--- Student Starting Attempt: POST /quizzes/:id/attempt ---");
    const startRes = await apiRequest(
      `/quizzes/${generatedQuiz._id}/attempt`,
      { method: "POST" },
      tokenStudent
    );
    console.log(`Start Attempt Status: ${startRes.status}`);
    if (startRes.status !== 201 || !startRes.data?.data?.attempt?._id) {
      throw new Error(`Start attempt failed: ${JSON.stringify(startRes.data)}`);
    }
    testAttempt = startRes.data.data.attempt;
    const attemptQuiz = startRes.data.data.quiz;
    console.log(`✓ Attempt started! ID: ${testAttempt._id}`);

    // Verify student quiz payload hides correct answers
    const hasLeakedAnswers = attemptQuiz.questions.some((q) =>
      q.options.some((opt) => opt.isCorrect !== undefined)
    );
    if (hasLeakedAnswers) {
      throw new Error("Security vulnerability: correct answers were leaked in student attempt questions!");
    }
    console.log("✓ Verified student questions DO NOT leak correct answers.");

    // 12. Student Submits Answers: POST /attempts/:id/submit
    console.log("\n--- Student Submitting Attempt: POST /attempts/:id/submit ---");
    // Look up the actual quiz from DB to know the right answers for testing
    const dbQuiz = await Quiz.findById(generatedQuiz._id);
    const answers = dbQuiz.questions.map((q) => {
      const correctOpt = q.options.find((opt) => opt.isCorrect);
      return {
        questionId: q._id.toString(),
        selectedOptionIds: correctOpt ? [correctOpt._id.toString()] : [q.options[0]._id.toString()],
      };
    });

    const submitRes = await apiRequest(
      `/attempts/${testAttempt._id}/submit`,
      {
        method: "POST",
        body: { answers },
      },
      tokenStudent
    );
    console.log(`Submit Attempt Status: ${submitRes.status}`);
    const gradedAttempt = submitRes.data?.data?.attempt || submitRes.data?.data;
    if (submitRes.status !== 200 || !gradedAttempt) {
      throw new Error(`Attempt submission failed: ${JSON.stringify(submitRes.data)}`);
    }
    const isPassed = gradedAttempt.passed !== undefined ? gradedAttempt.passed : gradedAttempt.isPassed;
    const score = gradedAttempt.percentage !== undefined ? gradedAttempt.percentage : gradedAttempt.score;
    console.log(`✓ Attempt graded: score=${score}%, passed=${isPassed}, points=${gradedAttempt.score}/${gradedAttempt.totalPoints}`);

    // 13. Student Checks Attempt Records: GET /quiz-attempts/me
    console.log("\n--- Student Checking Records: GET /quiz-attempts/me ---");
    const myAttemptsRes = await apiRequest("/quiz-attempts/me", {}, tokenStudent);
    console.log(`My Attempts Status: ${myAttemptsRes.status}`);
    const attemptsList = myAttemptsRes.data?.data?.attempts || [];
    if (!attemptsList.some((att) => att._id.toString() === testAttempt._id.toString())) {
      throw new Error("Submitted attempt not found in student attempt records.");
    }
    console.log(`✓ Student attempt verified in personal records! Total attempts: ${attemptsList.length}`);

    console.log("\n==================================================");
    console.log("🎉 ALL AI QUIZ GENERATION & ACCESS TESTS PASSED! 🎉");
    console.log("==================================================");
  } finally {
    console.log("\nCleaning up test artifacts...");
    if (testAttempt) await QuizAttempt.deleteMany({ _id: testAttempt._id });
    if (generatedQuiz) await Quiz.deleteMany({ _id: generatedQuiz._id });
    if (testLecture) {
      await TranscriptChunk.deleteMany({ lectureId: testLecture._id });
      await Lecture.deleteMany({ _id: testLecture._id });
    }
    if (testModule) await CourseModule.deleteMany({ _id: testModule._id });
    if (testCourse) {
      await Enrollment.deleteMany({ courseId: testCourse._id });
      await Course.deleteMany({ _id: testCourse._id });
    }
    if (instructorA) await User.deleteMany({ _id: instructorA._id });
    if (instructorB) await User.deleteMany({ _id: instructorB._id });
    if (studentUser) await User.deleteMany({ _id: studentUser._id });
    if (adminUser) await User.deleteMany({ _id: adminUser._id });

    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    console.log("Database disconnected and test server stopped.");
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
