# VertexLearn AI Frontend

Unified frontend architecture for VertexLearn AI, supporting three distinct role-based experiences: **Instructors**, **Students**, and **Administrators**.

## Architecture & Data Flow

```
					index.html
				    Single entry point
					    |
					    |
					src/main.js
				  Initialize application
					    |
					    |
			       Router + authentication guard
			   Determine the permitted role and page
					    |
					    |
Instructor				Student				     Admin
Courses, modules, quizzes   Catalog, learning, progress   Users, approvals, reports
					    |
					    |
				   Shared services
		API client · configuration · session · backend
```

## Directory Structure

```
├── forntend/
│   ├── index.html
│   ├── public/
│   │   └── assets/
│   │       ├── css/
│   │       ├── images/
│   │       └── fonts/
│   │
│   ├── src/
│   │   ├── main.js
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── navbar.js
│   │   │   │   ├── sidebar.js
│   │   │   │   ├── toast.js
│   │   │   │   ├── modal.js
│   │   │   │   └── loading.js
│   │   │   │
│   │   │   ├── instructor/
│   │   │   │   ├── course-card.js
│   │   │   │   ├── module-list.js
│   │   │   │   └── assessment-list.js
│   │   │   │
│   │   │   ├── student/
│   │   │   ├── admin/
│   │   │   └── ai-tutor/
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── login.html
│   │   │   │   ├── register.html
│   │   │   │   └── auth.js
│   │   │   │
│   │   │   ├── instructor/
│   │   │   │   ├── overview.html
│   │   │   │   ├── course-builder.html
│   │   │   │   ├── assessments.html
│   │   │   │   └── instructor.js
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── student-dashboard.html
│   │   │   │   └── dashboard.js
│   │   │   │
│   │   │   ├── course-catalog/
│   │   │   │   ├── catalog.html
│   │   │   │   └── catalog.js
│   │   │   │
│   │   │   ├── course-player/
│   │   │   │   ├── player.html
│   │   │   │   └── player.js
│   │   │   │
│   │   │   ├── quizzes/
│   │   │   │   ├── quiz.html
│   │   │   │   └── quiz.js
│   │   │   │
│   │   │   └── admin-panel/
│   │   │       ├── dashboard.html
│   │   │       ├── courses.html
│   │   │       ├── users.html
│   │   │       └── admin.js
│   │   │
│   │   ├── layouts/
│   │   │   ├── auth-layout.js
│   │   │   ├── instructor-layout.js
│   │   │   ├── student-layout.js
│   │   │   └── admin-layout.js
│   │   │
│   │   ├── routes/
│   │   │   ├── router.js
│   │   │   ├── route-guards.js
│   │   │   └── route-config.js
│   │   │
│   │   ├── services/
│   │   │   ├── config.js
│   │   │   ├── apiClient.js
│   │   │   ├── authService.js
│   │   │   ├── courseService.js
│   │   │   ├── quizService.js
│   │   │   ├── assignmentService.js
│   │   │   ├── enrollmentService.js
│   │   │   └── aiService.js
│   │   │
│   │   ├── store/
│   │   │   └── session.js
│   │   │
│   │   ├── utils/
│   │   │   ├── validation.js
│   │   │   ├── formatters.js
│   │   │   └── dom.js
│   │   │
│   │   └── styles/
│   │       ├── app.css
│   │       ├── auth.css
│   │       ├── instructor.css
│   │       ├── student.css
│   │       └── admin.css
│   │
│   └── README.md
```

## Shared Services & Store

1. **`services/config.js`**: Centralized API URL resolution using meta tags or `window.VERTEX_API_BASE_URL`.
2. **`services/apiClient.js`**: Robust `fetch`-based client handling authentication tokens, standard error formats, and session expiration events.
3. **`store/session.js`**: Single session store supporting multi-role storage with backward compatibility for legacy keys (`vertexlearn.instructor.session`).

## How to Run

1. Ensure the VertexLearn AI backend is running:
   ```bash
   cd backend
   npm run dev
   ```
2. Serve the `forntend/` directory with any static HTTP server (e.g., Python `http.server`, VS Code Live Server, or Node `npx serve`):
   ```bash
   cd forntend
   python -m http.server 8080
   ```
3. Open `http://localhost:8080` in your browser.
