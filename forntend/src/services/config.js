
const meta = document.querySelector('meta[name="vertex-api-base"]');

export const API_BASE_URL = (
  window.VERTEX_API_BASE_URL ||
  meta?.content ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");
