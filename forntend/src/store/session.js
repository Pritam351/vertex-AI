const SESSION_KEY = "vertexlearn.session";
const LEGACY_KEY = "vertexlearn.instructor.session";
const WORKFLOW_KEY = "vertexlearn.instructor.workflow";
const COURSES_KEY = "vertexlearn.instructor.courses";

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  if (!session) return;
  const serialized = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, serialized);
  localStorage.setItem(LEGACY_KEY, serialized);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(COURSES_KEY);
  sessionStorage.removeItem(WORKFLOW_KEY);
}

export function getCachedInstructorCourses() {
  try {
    return JSON.parse(localStorage.getItem(COURSES_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveCachedInstructorCourses(courses) {
  if (!courses) return;
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export function getUser() {
  const session = getSession();
  return session?.user || null;
}

export function getToken() {
  const session = getSession();
  return session?.token || null;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function hasRole(...roles) {
  const user = getUser();
  if (!user || !user.role) return false;
  return roles.includes(user.role.toLowerCase());
}

export function getWorkflow() {
  try {
    return JSON.parse(sessionStorage.getItem(WORKFLOW_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveWorkflow(workflow) {
  sessionStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
}

export function clearWorkflow() {
  sessionStorage.removeItem(WORKFLOW_KEY);
}
