<div align="center">

<img src="https://img.shields.io/badge/VertexLearn-AI-6e59f8?style=for-the-badge&logo=google&logoColor=white" alt="VertexLearn AI" height="40"/>

# 🎓 VertexLearn AI

### *AI-Powered Learning & Teaching Platform*

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

> A full-stack LMS (Learning Management System) with built-in Gemini AI — supporting students, instructors, and administrators on one unified platform.

---

[🚀 Quick Start](#-quick-start) · [⚙️ Configuration](#️-environment-configuration) · [📁 Project Structure](#-project-structure) · [🔌 API Reference](#-api-reference) · [👤 Roles & Features](#-roles--features) · [🛠️ Production](#️-production-deployment)

</div>

---

## ✨ Features at a Glance

| 🎓 For Students | 🧑‍🏫 For Instructors | 🛡️ For Admins |
|---|---|---|
| Enroll in courses | Create & manage courses | Full user management |
| AI-powered quiz generation | Build assessments & quizzes | Role assignment |
| AI study plans & flashcards | View analytics per course | Platform moderation |
| AI chat assistant | Make announcements | Dashboard statistics |
| Track progress & certificates | Discussion management | Content oversight |
| Discussion forums | Course content upload | Audit & reporting |
| Gamification & badges | Student progress tracking | — |

---

## 📁 Project Structure

```
vertex-AI/
│
├── 📂 backend/                     ← Node.js + Express REST API
│   ├── src/
│   │   ├── ai/                     ← Gemini AI: chat, flashcards, study plans, embeddings
│   │   ├── config/
│   │   │   └── db.js               ← MongoDB connection
│   │   ├── middleware/             ← Auth, roles, rate limiting, error handling
│   │   ├── modules/
│   │   │   ├── admin/              ← Admin dashboard routes & controllers
│   │   │   ├── announcements/      ← Instructor announcements
│   │   │   ├── assignments/        ← Assignment submissions
│   │   │   ├── auth/               ← Register, login, JWT
│   │   │   ├── certificates/       ← Auto-generated completion certificates
│   │   │   ├── courses/            ← Course CRUD + content management
│   │   │   ├── discussions/        ← Forum threads & replies
│   │   │   ├── enrollments/        ← Enrollment + learning progress
│   │   │   ├── gamification/       ← Points, badges, leaderboard
│   │   │   ├── notifications/      ← User notification system
│   │   │   ├── quizzes/            ← AI-generated & manual quizzes
│   │   │   └── users/              ← User profile management
│   │   ├── utils/                  ← Shared utilities
│   │   ├── app.js                  ← Express app setup (CORS, Helmet, routes)
│   │   └── server.js               ← Entry point
│   ├── tests/                      ← Dev verification scripts
│   ├── .env                        ← 🔒 Secret config (DO NOT commit)
│   ├── .env.example                ← Template for environment variables
│   └── package.json
│
├── 📂 forntend/                    ← Vanilla JS + HTML/CSS SPA (no framework)
│   ├── public/assets/              ← Static assets (images, icons)
│   ├── src/
│   │   ├── components/             ← Reusable UI components
│   │   ├── hooks/                  ← Shared JS logic hooks
│   │   ├── layouts/                ← Page shell layouts
│   │   ├── pages/
│   │   │   ├── admin-panel/        ← Admin dashboard (users, courses, moderation)
│   │   │   ├── auth/               ← Login & Register pages
│   │   │   ├── certificates/       ← Certificate viewer
│   │   │   ├── course-catalog/     ← Browse all courses
│   │   │   ├── course-player/      ← Watch & learn (video + AI chat)
│   │   │   ├── dashboard/          ← Student dashboard
│   │   │   ├── discussions/        ← Discussion forums
│   │   │   ├── home/               ← Landing page
│   │   │   ├── instructor/         ← Instructor dashboard, analytics, builder
│   │   │   └── quizzes/            ← Quiz taking interface
│   │   ├── routes/                 ← Client-side SPA routing
│   │   ├── services/               ← API client + per-module service files
│   │   ├── store/                  ← Session / auth state
│   │   ├── styles/                 ← CSS per page + global
│   │   └── utils/                  ← Frontend helpers
│   ├── index.html                  ← App shell entry point
│   └── README.md
│
└── 📄 README.md                    ← ← ← You are here
```

---

## 🚀 Quick Start

### Prerequisites

Make sure you have these installed:

| Tool | Version | Link |
|------|---------|------|
| ![Node](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white&style=flat-square) | v18 or higher | [nodejs.org](https://nodejs.org) |
| ![npm](https://img.shields.io/badge/-npm-CB3837?logo=npm&logoColor=white&style=flat-square) | comes with Node | — |
| ![MongoDB](https://img.shields.io/badge/-MongoDB_Atlas-47A248?logo=mongodb&logoColor=white&style=flat-square) | Free cluster | [mongodb.com](https://cloud.mongodb.com) |
| Any static server | e.g. Live Server | VS Code Extension |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/vertex-AI.git
cd vertex-AI
```

---

### Step 2 — Backend Setup

```bash
# Navigate to backend
cd backend

# Install all dependencies
npm install
```

#### 📄 Create your `.env` file

```bash
# Copy the template
copy .env.example .env
```

Now open `backend/.env` and fill in your values:

```env
# ─── Server ───────────────────────────────────────
PORT=5000
NODE_ENV=development

# ─── Database ─────────────────────────────────────
# Get this from MongoDB Atlas → Connect → Drivers
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0

# ─── JWT Auth ─────────────────────────────────────
# Must be at least 32 random characters
JWT_SECRET=replace_with_a_very_long_random_secret_here
JWT_EXPIRES_IN=1d

# ─── CORS ─────────────────────────────────────────
# The URL where your frontend will run (no trailing slash)
ALLOWED_ORIGIN=http://localhost:5173

# ─── Google Gemini AI ─────────────────────────────
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

#### ▶️ Start the backend

```bash
# Development mode (auto-restart on file changes)
npm run dev

# OR production mode
npm start
```

✅ You should see:
```
MongoDB connected successfully
Server running on http://localhost:5000
```

---

### Step 3 — Frontend Setup

The frontend is a **plain HTML/CSS/JS SPA** — no build step required.

#### 🔧 One code change needed — point it to your backend

Open `forntend/index.html` and update line 5:

```html
<!-- 🔴 CHANGE THIS LINE: -->
<meta name="vertex-api-base" content="http://localhost:5000/api/v1" />

<!-- ✅ For local development, keep it as: -->
<meta name="vertex-api-base" content="http://localhost:5000/api/v1" />

<!-- 🚀 For production, change to your deployed backend URL: -->
<meta name="vertex-api-base" content="https://your-api-domain.com/api/v1" />
```

#### ▶️ Serve the frontend

**Option A — VS Code Live Server (easiest)**
1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
2. Right-click `forntend/index.html` → **Open with Live Server**
3. Opens at `http://127.0.0.1:5500`

**Option B — `npx serve`**
```bash
cd forntend
npx serve .
# Opens at http://localhost:3000
```

**Option C — Python (if installed)**
```bash
cd forntend
python -m http.server 5173
# Opens at http://localhost:5173
```

> 💡 Make sure `ALLOWED_ORIGIN` in your `.env` matches the URL you serve the frontend from!

---

## ⚙️ Environment Configuration

### Backend `.env` — Complete Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | ✅ | Port the API server listens on | `5000` |
| `NODE_ENV` | ✅ | `development` or `production` | `development` |
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs (min 32 chars) | `my_super_secret_...` |
| `JWT_EXPIRES_IN` | ✅ | Token lifespan | `1d` |
| `ALLOWED_ORIGIN` | ✅ | Frontend origin for CORS (no trailing `/`) | `http://localhost:5173` |
| `GEMINI_API_KEY` | ✅ | Google Gemini AI API key | `AIza...` |

### How to get each value

<details>
<summary><b>🍃 MongoDB Atlas URI</b></summary>

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0** cluster
3. Click **Connect** → **Drivers**
4. Copy the connection string
5. Replace `<password>` with your DB user password
6. Add `?appName=Cluster0` at the end

</details>

<details>
<summary><b>🤖 Gemini API Key</b></summary>

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key and paste it as `GEMINI_API_KEY`

</details>

<details>
<summary><b>🔑 JWT Secret</b></summary>

Generate a strong random secret in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output and use it as your `JWT_SECRET`.

</details>

---

## 👤 Roles & Features

### 🧑‍🎓 Student

| Feature | How to Access |
|---------|--------------|
| Browse course catalog | Home page → Browse Courses |
| Enroll in a course | Course detail page → Enroll |
| Watch lessons | My Dashboard → continue learning |
| Take AI-generated quizzes | Inside course player |
| AI Chat Assistant | Course player → AI Chat tab |
| AI Study Plan | Dashboard → Study Plan |
| View & download certificates | Dashboard → Certificates |
| Join discussions | Course page → Discussions |
| Earn badges | Auto-awarded on milestones |

### 🧑‍🏫 Instructor

| Feature | How to Access |
|---------|--------------|
| Create a course | Instructor Dashboard → New Course |
| Add lessons/content | Course Builder → Add Sections |
| Create quizzes | Assessments tab |
| View student analytics | Analytics → per-course stats |
| Make announcements | Announcements tab |
| Manage discussions | Discussions tab |

### 🛡️ Admin

| Feature | How to Access |
|---------|--------------|
| View platform stats | Admin Panel → Dashboard |
| Manage all users | Admin Panel → Users |
| Change user roles | Users table → Edit Role |
| Suspend/reactivate users | Users table → Toggle Status |
| Course moderation | Admin Panel → Courses |
| Content moderation | Admin Panel → Moderation |

---

## 🔌 API Reference

Base URL: `http://localhost:5000/api/v1`

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/auth/register` | Public | Register new user |
| `POST` | `/auth/login` | Public | Login, returns JWT |
| `GET` | `/auth/me` | 🔒 Auth | Get logged-in user profile |

### Courses
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/courses` | Public | List all courses |
| `GET` | `/courses/:id` | Public | Get single course |
| `POST` | `/courses` | 🔒 Instructor | Create a course |
| `PUT` | `/courses/:id` | 🔒 Instructor | Update a course |
| `DELETE` | `/courses/:id` | 🔒 Instructor | Delete a course |
| `GET` | `/courses/mine` | 🔒 Instructor | My courses |
| `GET` | `/courses/:id/analytics` | 🔒 Instructor | Course analytics |

### AI Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/ai/chat` | 🔒 Auth | AI chat message |
| `POST` | `/ai/quiz` | 🔒 Auth | Generate quiz from content |
| `POST` | `/ai/study-plan` | 🔒 Auth | Generate a study plan |
| `POST` | `/ai/flashcards` | 🔒 Auth | Generate flashcards |

### Admin
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/admin/stats` | 🔒 Admin | Platform statistics |
| `GET` | `/admin/users` | 🔒 Admin | All users (with filters) |
| `PATCH` | `/admin/users/:id/status` | 🔒 Admin | Suspend / reactivate user |
| `PATCH` | `/admin/users/:id/role` | 🔒 Admin | Change user role |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns `200 OK` if API is running |

---

## 🛠️ Production Deployment

### Backend Code Changes

**1. Update `backend/src/app.js` — Restrict CORS:**
```js
// ❌ Change this (allows ALL origins — insecure):
app.use(cors());

// ✅ To this:
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  credentials: true,
}));
```

**2. Update `backend/.env`:**
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=<your production Atlas URI>
JWT_SECRET=<new 64-char random secret>
ALLOWED_ORIGIN=https://your-frontend-domain.com
GEMINI_API_KEY=<production Gemini key>
```

### Frontend Code Changes

**3. Update `forntend/index.html`:**
```html
<meta name="vertex-api-base" content="https://your-api-domain.com/api/v1" />
```

### Files to Exclude from Git

Add a root `.gitignore`:
```gitignore
# Dependencies
node_modules/

# Secrets
.env

# Logs
*.log

# Editor
.vscode/

# AI Dev Tools
forntend/.agents/
forntend/skills-lock.json
```

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology |
|-------|-----------|
| **Backend Runtime** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) |
| **Backend Framework** | ![Express](https://img.shields.io/badge/Express_v5-000000?style=flat-square&logo=express&logoColor=white) |
| **Database** | ![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white) |
| **ODM** | ![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=flat-square&logo=mongoose&logoColor=white) |
| **AI** | ![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=flat-square&logo=google&logoColor=white) |
| **Auth** | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) |
| **Security** | ![Helmet](https://img.shields.io/badge/Helmet-orange?style=flat-square) + Rate Limiting |
| **Frontend** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) ![JS](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **Validation** | ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square) |

</div>

---

## 🐛 Common Issues & Fixes

<details>
<summary><b>❌ "MongoDB connection failed"</b></summary>

- Make sure your IP is whitelisted in MongoDB Atlas → Network Access → `0.0.0.0/0` for local dev
- Check your `MONGODB_URI` has the correct password (no special characters unescaped)

</details>

<details>
<summary><b>❌ "CORS error" in browser console</b></summary>

- Make sure `ALLOWED_ORIGIN` in `.env` exactly matches the URL your frontend runs on (no trailing slash)
- Example: if frontend runs at `http://127.0.0.1:5500`, set `ALLOWED_ORIGIN=http://127.0.0.1:5500`

</details>

<details>
<summary><b>❌ AI features not working</b></summary>

- Confirm your `GEMINI_API_KEY` is valid at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- Make sure you have internet access from your backend server

</details>

<details>
<summary><b>❌ "JWT_SECRET is not set" crash on startup</b></summary>

- Your `.env` file is missing or not being loaded
- Make sure `.env` is in the `backend/` folder (not root)
- Run `npm run dev` from inside the `backend/` directory

</details>

---

## 📜 License

This project is licensed under the **ISC License**.

---

<div align="center">

Made with ❤️ by the **VertexLearn AI Team**

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-username/vertex-AI)

</div>

