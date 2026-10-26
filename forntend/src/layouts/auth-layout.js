export function renderAuthLayout(formHtml, isRegister = false) {
  return `
    <section class="auth-screen" id="auth-screen" aria-labelledby="login-title">
      <div class="auth-brand">
        <a class="brand" href="#/login" aria-label="VertexLearn AI home">
          <span class="brand-mark" aria-hidden="true">✦</span>
          <span>VERTEX<span>LEARN</span> AI</span>
        </a>
        <p class="eyebrow">${isRegister ? "STUDENT REGISTRATION" : "UNIFIED PORTAL"}</p>
        <h1 id="login-title">
          ${isRegister ? "Join a vibrant community of<br /><em>AI-empowered learners.</em>" : "Build learning that<br /><em>moves people forward.</em>"}
        </h1>
        <p class="auth-copy">
          ${
            isRegister
              ? "Create your student account to access AI-curated courses, interactive quizzes, video lectures, and personal study roadmaps."
              : "Sign in with your role credentials. Instructors build courses, students master skills, and administrators maintain excellence."
          }
        </p>
        <ul class="auth-points">
          <li>Course & curriculum authoring for instructors</li>
          <li>Interactive learning, quizzes & AI tutor for students</li>
          <li>Review workflows & moderation for administrators</li>
        </ul>
      </div>
      <div class="auth-card" id="auth-card-content">
        ${formHtml}
      </div>
    </section>
  `;
}
