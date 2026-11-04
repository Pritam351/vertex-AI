const meta = document.querySelector('meta[name="vertex-api-base"]');

let base = (
  window.VERTEX_API_BASE_URL ||
  meta?.content ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");

// Ensure API base always points to the versioned root /api/v1
if (!base.endsWith("/api/v1")) {
  base = `${base}/api/v1`;
}

export const API_BASE_URL = base;
