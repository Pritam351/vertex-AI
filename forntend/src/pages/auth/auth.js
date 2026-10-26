import { authService } from "../../services/authService.js";
import { $, message } from "../../utils/dom.js";
import { errorText } from "../../utils/validation.js";
import { setBusy } from "../../components/common/loading.js";
import { toast } from "../../components/common/toast.js";
import { DEFAULT_ROUTES } from "../../routes/route-config.js";

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
        window.location.hash = DEFAULT_ROUTES[role] || DEFAULT_ROUTES.student;
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
        window.location.hash = DEFAULT_ROUTES[role] || DEFAULT_ROUTES.student;
      } catch (error) {
        message(msgEl, errorText(error), "error");
      } finally {
        setBusy(button, false);
      }
    });
  }
}
