export const DEFAULT_ROUTES = {
  instructor: "#/instructor/overview",
  student: "#/student/dashboard",
  admin: "#/admin/dashboard",
  unauthenticated: "#/" // Changed to homepage instead of login
};

export const ROUTES = {
  // Public Homepage
  HOME: {
    hash: "#/",
    role: null,
    title: "VertexLearn AI | Home",
    layout: null,
    isPublic: true
  },

  // Auth
  LOGIN: {
    hash: "#/login",
    role: null,
    title: "Sign In | VertexLearn AI",
    layout: "auth"
  },
  REGISTER: {
    hash: "#/register",
    role: null,
    title: "Create Account | VertexLearn AI",
    layout: "auth"
  },

  // Instructor
  INSTRUCTOR_OVERVIEW: {
    hash: "#/instructor/overview",
    role: "instructor",
    title: "Overview | Instructor Studio",
    layout: "instructor",
    section: "overview"
  },
  INSTRUCTOR_BUILDER: {
    hash: "#/instructor/course-builder",
    role: "instructor",
    title: "Course Builder | Instructor Studio",
    layout: "instructor",
    section: "course-builder"
  },
  INSTRUCTOR_ASSESSMENTS: {
    hash: "#/instructor/assessments",
    role: "instructor",
    title: "Assessments | Instructor Studio",
    layout: "instructor",
    section: "assessments"
  },
  INSTRUCTOR_ANNOUNCEMENTS: {
    hash: "#/instructor/announcements",
    role: "instructor",
    title: "Announcements | Instructor Studio",
    layout: "instructor",
    section: "announcements"
  },
  INSTRUCTOR_DISCUSSIONS: {
    hash: "#/instructor/discussions",
    role: "instructor",
    title: "Discussions & Q&A | Instructor Studio",
    layout: "instructor",
    section: "discussions"
  },
  INSTRUCTOR_ANALYTICS: {
    hash: "#/instructor/analytics",
    role: "instructor",
    title: "Analytics | Instructor Studio",
    layout: "instructor",
    section: "analytics"
  },

  // Student
  STUDENT_DASHBOARD: {
    hash: "#/student/dashboard",
    role: "student",
    title: "My Dashboard | VertexLearn AI",
    layout: "student",
    section: "dashboard"
  },
  STUDENT_CATALOG: {
    hash: "#/student/catalog",
    role: "student",
    title: "Course Catalog | VertexLearn AI",
    layout: "student",
    section: "catalog"
  },
  STUDENT_PLAYER: {
    hash: "#/student/player",
    role: "student",
    title: "Course Player | VertexLearn AI",
    layout: "student",
    section: "player"
  },
  STUDENT_QUIZZES: {
    hash: "#/student/quizzes",
    role: "student",
    title: "My Quizzes | VertexLearn AI",
    layout: "student",
    section: "quizzes"
  },
  STUDENT_DISCUSSIONS: {
    hash: "#/student/discussions",
    role: "student",
    title: "Discussions & Q&A | VertexLearn AI",
    layout: "student",
    section: "discussions"
  },
  STUDENT_CERTIFICATES: {
    hash: "#/student/certificates",
    role: "student",
    title: "My Certificates | VertexLearn AI",
    layout: "student",
    section: "certificates"
  },

  // Admin
  ADMIN_DASHBOARD: {
    hash: "#/admin/dashboard",
    role: "admin",
    title: "Admin Dashboard | VertexLearn AI",
    layout: "admin",
    section: "dashboard"
  },
  ADMIN_COURSES: {
    hash: "#/admin/courses",
    role: "admin",
    title: "Course Approvals | Admin Panel",
    layout: "admin",
    section: "courses"
  },
  ADMIN_USERS: {
    hash: "#/admin/users",
    role: "admin",
    title: "User Management | Admin Panel",
    layout: "admin",
    section: "users"
  },
  ADMIN_MODERATION: {
    hash: "#/admin/moderation",
    role: "admin",
    title: "Forum Moderation | Admin Panel",
    layout: "admin",
    section: "moderation"
  }
};
