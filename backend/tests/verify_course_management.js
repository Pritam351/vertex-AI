require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/modules/users/userModel");
const Course = require("../src/modules/courses/courseModel");
const CourseModule = require("../src/modules/courses/moduleModel");
const Lecture = require("../src/modules/courses/lectureModel");
const { generateToken } = require("../src/utils/jwt");

async function runTests() {
  console.log("Connecting to database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Database connected.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Test server running at ${baseUrl}`);

  let instructorA, instructorB, tokenA, tokenB;
  let testCourse, testModule, testLecture;

  try {
    // Setup test instructors
    const emailA = `test_inst_a_${Date.now()}@example.com`;
    const emailB = `test_inst_b_${Date.now()}@example.com`;

    instructorA = await User.create({
      fullName: "Instructor Alice",
      email: emailA,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenA = generateToken(instructorA);

    instructorB = await User.create({
      fullName: "Instructor Bob",
      email: emailB,
      passwordHash: "hash123",
      role: "instructor",
      isActive: true,
    });
    tokenB = generateToken(instructorB);

    console.log("✓ Created Instructor A and Instructor B");

    // -------------------------------------------------------------
    // Test 1: Course creation and editing
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Create, then edit a course ---");
    const createCourseRes = await fetch(`${baseUrl}/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Introduction to Artificial Intelligence",
        description: "Initial description",
        category: "Artificial Intelligence",
        difficulty: "beginner",
        price: 99.99,
      }),
    });
    const createCourseData = await createCourseRes.json();
    if (!createCourseRes.ok || !createCourseData.data?.course) {
      throw new Error(`Course creation failed: ${JSON.stringify(createCourseData)}`);
    }
    testCourse = createCourseData.data.course;
    console.log(`✓ Course created with ID: ${testCourse._id}, Title: "${testCourse.title}"`);

    // Edit the course
    const editCourseRes = await fetch(`${baseUrl}/courses/${testCourse._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Advanced Artificial Intelligence & Deep Learning",
        description: "Updated advanced syllabus description",
        price: 149.99,
        difficulty: "advanced",
      }),
    });
    const editCourseData = await editCourseRes.json();
    if (!editCourseRes.ok || editCourseData.data?.course?.title !== "Advanced Artificial Intelligence & Deep Learning") {
      throw new Error(`Course edit failed: ${JSON.stringify(editCourseData)}`);
    }
    console.log(`✓ Course edited successfully! New Title: "${editCourseData.data.course.title}", Price: ₹${editCourseData.data.course.price}`);

    // -------------------------------------------------------------
    // Test 2: Add, rename and list modules
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Add, rename and list modules ---");
    const addModuleRes = await fetch(`${baseUrl}/courses/${testCourse._id}/modules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Module 1: Foundations",
        orderIndex: 1,
      }),
    });
    const addModuleData = await addModuleRes.json();
    if (!addModuleRes.ok || !addModuleData.data?.module) {
      throw new Error(`Add module failed: ${JSON.stringify(addModuleData)}`);
    }
    testModule = addModuleData.data.module;
    console.log(`✓ Module added: "${testModule.title}" (ID: ${testModule._id})`);

    // Rename module
    const renameModuleRes = await fetch(`${baseUrl}/modules/${testModule._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Module 1: Neural Networks & Core Foundations (Renamed)",
        orderIndex: 1,
      }),
    });
    const renameModuleData = await renameModuleRes.json();
    if (!renameModuleRes.ok || renameModuleData.data?.module?.title !== "Module 1: Neural Networks & Core Foundations (Renamed)") {
      throw new Error(`Rename module failed: ${JSON.stringify(renameModuleData)}`);
    }
    console.log(`✓ Module renamed successfully to: "${renameModuleData.data.module.title}"`);

    // List modules
    const listModulesRes = await fetch(`${baseUrl}/courses/${testCourse._id}/modules`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listModulesData = await listModulesRes.json();
    if (!listModulesRes.ok || !listModulesData.data?.modules?.length) {
      throw new Error(`List modules failed: ${JSON.stringify(listModulesData)}`);
    }
    console.log(`✓ List modules verified: found ${listModulesData.data.modules.length} module(s). First module title: "${listModulesData.data.modules[0].title}"`);

    // -------------------------------------------------------------
    // Test 3: Add lectures with video URLs and transcripts
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Add lectures with video URLs and transcripts ---");
    const sampleVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const sampleTranscript = "Welcome to Lecture 1 on Neural Networks. Today we cover perceptrons, activation functions, weights, biases, and gradient descent optimization algorithms.";

    const addLectureRes = await fetch(`${baseUrl}/modules/${testModule._id}/lectures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Lecture 1.1: Perceptrons and Activation Functions",
        videoUrl: sampleVideoUrl,
        durationSeconds: 720,
        transcript: sampleTranscript,
        resourceUrls: ["https://example.com/slides.pdf"],
      }),
    });
    const addLectureData = await addLectureRes.json();
    if (!addLectureRes.ok || !addLectureData.data?.lecture) {
      throw new Error(`Add lecture failed: ${JSON.stringify(addLectureData)}`);
    }
    testLecture = addLectureData.data.lecture;
    if (testLecture.videoUrl !== sampleVideoUrl || testLecture.transcript !== sampleTranscript) {
      throw new Error(`Lecture videoUrl or transcript mismatch!`);
    }
    console.log(`✓ Lecture added with videoUrl: "${testLecture.videoUrl}" and transcript length: ${testLecture.transcript.length} characters.`);

    // -------------------------------------------------------------
    // Test 4: Reload the course and verify the curriculum persists
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Reload course and verify curriculum persists ---");
    const reloadRes = await fetch(`${baseUrl}/courses/${testCourse._id}/modules`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const reloadData = await reloadRes.json();
    if (!reloadRes.ok) {
      throw new Error(`Reload modules failed: ${JSON.stringify(reloadData)}`);
    }
    const loadedModules = reloadData.data?.modules || [];
    if (loadedModules.length !== 1) {
      throw new Error(`Expected 1 module, got ${loadedModules.length}`);
    }
    const loadedModule = loadedModules[0];
    if (loadedModule.title !== "Module 1: Neural Networks & Core Foundations (Renamed)") {
      throw new Error(`Module title mismatch on reload: "${loadedModule.title}"`);
    }
    if (!loadedModule.lectures || loadedModule.lectures.length !== 1) {
      throw new Error(`Expected 1 lecture inside module on reload, got ${loadedModule.lectures?.length}`);
    }
    const loadedLecture = loadedModule.lectures[0];
    if (loadedLecture.videoUrl !== sampleVideoUrl) {
      throw new Error(`Lecture videoUrl did not persist: "${loadedLecture.videoUrl}"`);
    }
    if (loadedLecture.transcript !== sampleTranscript) {
      throw new Error(`Lecture transcript did not persist! Got: "${loadedLecture.transcript}"`);
    }
    console.log(`✓ Curriculum persists perfectly across reload! Modules: ${loadedModules.length}, Lectures: ${loadedModule.lectures.length}, Video URL & full transcript intact.`);

    // -------------------------------------------------------------
    // Test 5: Ensure instructors cannot edit another instructor's course
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Verify instructors cannot edit another instructor's course ---");

    // 5a. Instructor B tries to edit Instructor A's course
    const bEditCourse = await fetch(`${baseUrl}/courses/${testCourse._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Hacked by Bob" }),
    });
    console.log(`✓ Instructor B editing course: HTTP ${bEditCourse.status} (Expected 403)`);
    if (bEditCourse.status !== 403) throw new Error(`Expected 403, got ${bEditCourse.status}`);

    // 5b. Instructor B tries to add a module to Instructor A's course
    const bAddModule = await fetch(`${baseUrl}/courses/${testCourse._id}/modules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Bob's rogue module" }),
    });
    console.log(`✓ Instructor B adding module: HTTP ${bAddModule.status} (Expected 403)`);
    if (bAddModule.status !== 403) throw new Error(`Expected 403, got ${bAddModule.status}`);

    // 5c. Instructor B tries to rename Instructor A's module
    const bRenameModule = await fetch(`${baseUrl}/modules/${testModule._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Bob's renamed module" }),
    });
    console.log(`✓ Instructor B renaming module: HTTP ${bRenameModule.status} (Expected 403)`);
    if (bRenameModule.status !== 403) throw new Error(`Expected 403, got ${bRenameModule.status}`);

    // 5d. Instructor B tries to delete Instructor A's module
    const bDeleteModule = await fetch(`${baseUrl}/modules/${testModule._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log(`✓ Instructor B deleting module: HTTP ${bDeleteModule.status} (Expected 403)`);
    if (bDeleteModule.status !== 403) throw new Error(`Expected 403, got ${bDeleteModule.status}`);

    // 5e. Instructor B tries to add a lecture to Instructor A's module
    const bAddLecture = await fetch(`${baseUrl}/modules/${testModule._id}/lectures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Bob's lecture" }),
    });
    console.log(`✓ Instructor B adding lecture: HTTP ${bAddLecture.status} (Expected 403)`);
    if (bAddLecture.status !== 403) throw new Error(`Expected 403, got ${bAddLecture.status}`);

    // 5f. Instructor B tries to edit Instructor A's lecture
    const bEditLecture = await fetch(`${baseUrl}/lectures/${testLecture._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Bob edited this lecture" }),
    });
    console.log(`✓ Instructor B editing lecture: HTTP ${bEditLecture.status} (Expected 403)`);
    if (bEditLecture.status !== 403) throw new Error(`Expected 403, got ${bEditLecture.status}`);

    // 5g. Instructor B tries to delete Instructor A's lecture
    const bDeleteLecture = await fetch(`${baseUrl}/lectures/${testLecture._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log(`✓ Instructor B deleting lecture: HTTP ${bDeleteLecture.status} (Expected 403)`);
    if (bDeleteLecture.status !== 403) throw new Error(`Expected 403, got ${bDeleteLecture.status}`);

    // 5h. Instructor B tries to delete Instructor A's course
    const bDeleteCourse = await fetch(`${baseUrl}/courses/${testCourse._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log(`✓ Instructor B deleting course: HTTP ${bDeleteCourse.status} (Expected 403)`);
    if (bDeleteCourse.status !== 403) throw new Error(`Expected 403, got ${bDeleteCourse.status}`);

    console.log("\n==========================================");
    console.log("🎉 ALL 5 REQUIREMENTS VERIFIED SUCCESSFULLY!");
    console.log("==========================================");
  } finally {
    // Cleanup test data
    console.log("\nCleaning up test records...");
    if (testLecture) await Lecture.deleteOne({ _id: testLecture._id });
    if (testModule) await CourseModule.deleteOne({ _id: testModule._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (instructorA) await User.deleteOne({ _id: instructorA._id });
    if (instructorB) await User.deleteOne({ _id: instructorB._id });

    server.close();
    await mongoose.disconnect();
    console.log("Cleanup complete and disconnected.");
  }
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
