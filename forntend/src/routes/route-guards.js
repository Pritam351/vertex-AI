import { getSession } from "../store/session.js";
import { DEFAULT_ROUTES } from "./route-config.js";

export function checkRouteAccess(targetHash = window.location.hash) {
  const session = getSession();
  const user = session?.user;
  const role = user?.role ? user.role.toLowerCase() : null;

  // Normalize hash
  const hash = targetHash.split("?")[0].replace(/\/$/, "");

  // Public/Auth routes
  const isAuthRoute = hash === "#/login" || hash === "#/register" || hash === "#login" || hash === "#register";
  const isRootRoute = !hash || hash === "#" || hash === "#/" || hash === "";

  if (!user || !session?.token) {
    if (isAuthRoute) return { allowed: true, redirect: null };
    // Not authenticated, redirect to login
    return {
      allowed: false,
      redirect: DEFAULT_ROUTES.unauthenticated
    };
  }

  // User is authenticated
  if (isAuthRoute || isRootRoute) {
    const defaultRoute = DEFAULT_ROUTES[role] || DEFAULT_ROUTES.unauthenticated;
    return {
      allowed: false,
      redirect: defaultRoute
    };
  }

  // Check role-based route constraints
  if (hash.startsWith("#/instructor") && role !== "instructor" && role !== "admin") {
    return {
      allowed: false,
      redirect: DEFAULT_ROUTES[role] || DEFAULT_ROUTES.unauthenticated
    };
  }

  if (hash.startsWith("#/admin") && role !== "admin") {
    return {
      allowed: false,
      redirect: DEFAULT_ROUTES[role] || DEFAULT_ROUTES.unauthenticated
    };
  }

  if (hash.startsWith("#/student") && role !== "student" && role !== "admin") {
    return {
      allowed: false,
      redirect: DEFAULT_ROUTES[role] || DEFAULT_ROUTES.unauthenticated
    };
  }

  return { allowed: true, redirect: null };
}
