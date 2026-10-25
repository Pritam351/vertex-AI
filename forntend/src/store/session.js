
const SESSION_KEY = "vertexlearn.instructor.session";
const WORKFLOW_KEY = "vertexlearn.instructor.workflow";

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(WORKFLOW_KEY);
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
