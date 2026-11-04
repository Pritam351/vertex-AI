import { authService } from "../../services/authService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { $, message } from "../../utils/dom.js";
import { errorText } from "../../utils/validation.js";
import { setBusy } from "../../components/common/loading.js";
import { toast } from "../../components/common/toast.js";
import { DEFAULT_ROUTES } from "../../routes/route-config.js";

/**
 * After a successful login or registration, check sessionStorage for a
 * pending enrollment intent saved by home.js and fulfil it before redirecting.
 * This completes the visitor → registration → automatic-enrollment flow.
 */
async function handlePendingEnrollmentAndRedirect(role) {
  const pendingCourseId = (() => {
    try { return sessionStorage.getItem("vertex:pendingEnrollment"); } catch { return null; }
  })();

  if (pendingCourseId) {
    try { sessionStorage.removeItem("vertex:pendingEnrollment"); } catch { /* ignore */ }
    try {
      await enrollmentService.enroll(pendingCourseId);
      toast("Enrolled successfully! Starting course…", "success");
      // Give the toast a moment to show, then jump to the course player.
      setTimeout(() => {
        window.location.hash = `#/student/player?courseId=${pendingCourseId}`;
      }, 1200);
      return; // early exit — redirect already scheduled
    } catch (err) {
      // Enrollment failed (e.g. already enrolled or course removed).
      // Fall through to the normal dashboard redirect.
      console.warn("Pending enrollment failed:", err?.message || err);
      toast(err?.message || "Could not auto-enroll. You can enroll from the dashboard.", "error");
    }
  }

  // Default: send the user to their role dashboard.
  window.location.hash = DEFAULT_ROUTES[role] || DEFAULT_ROUTES.student;
}

export function bindAuthEvents(container = document, isRegister = false) {
  if (isRegister) {
    const regForm = $("#register-form", container);
    regForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type='submit']");
      const msgEl = $("#register-message", form);
      const data = Object.fromEntries(new FormData(form));

      if (!data.fullName || !data.email || !data.password) {
        return message(msgEl, "Please fill in all required fields.", "error");
      }
      if (data.password.length < 6) {
        return message(msgEl, "Password must be at least 6 characters.", "error");
      }

      message(msgEl);
      setBusy(button, true, "Creating account…");

      try {
        const payload = await authService.register(data);
        toast("Account created successfully!");
        const user = payload?.data?.user;
        const role = user?.role?.toLowerCase() || "student";
        // Fulfil any pending enrollment intent, then redirect.
        await handlePendingEnrollmentAndRedirect(role);
      } catch (error) {
        message(msgEl, errorText(error), "error");
      } finally {
        setBusy(button, false);
      }
    });
  } else {
    const loginForm = $("#login-form", container);
    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type='submit']");
      const msgEl = $("#login-message", form);
      const data = Object.fromEntries(new FormData(form));

      if (!data.email || !data.password) {
        return message(msgEl, "Enter your email and password.", "error");
      }

      message(msgEl);
      setBusy(button, true, "Signing in…");

      try {
        const payload = await authService.login(data);
        toast("Signed in successfully.");
        const user = payload?.data?.user;
        const role = user?.role?.toLowerCase() || "student";
        // Fulfil any pending enrollment intent, then redirect.
        await handlePendingEnrollmentAndRedirect(role);
      } catch (error) {
        message(msgEl, errorText(error), "error");
      } finally {
        setBusy(button, false);
      }
    });
  }
}
