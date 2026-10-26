export function formatDate(value, options = { dateStyle: "medium" }) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatCurrency(amount, currency = "INR") {
  const num = Number(amount || 0);
  if (num <= 0) return "Free";
  if (currency === "INR" || !currency) {
    return `₹${num}`;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format(num);
}

export function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "VL"
  );
}

export function formatDuration(seconds) {
  const s = Number(seconds || 0);
  if (!s) return "0 min";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins ? `${hours}h ${remainingMins}m` : `${hours}h`;
}
