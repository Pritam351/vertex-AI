export function errorText(error) {
  if (!error) return "An unexpected error occurred.";
  const detail = error?.errors?.[0];
  if (detail?.message) {
    return `${error.message}: ${detail.message}`;
  }
  return error.message || String(error);
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isNonEmptyString(value, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}
