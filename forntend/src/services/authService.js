import { api } from "./apiClient.js";
import { saveSession, clearSession, getSession } from "../store/session.js";

export const authService = {
  async login(credentials) {
    const payload = await api("/auth/login", {
      method: "POST",
      auth: false,
      body: credentials
    });
    if (payload?.data?.token) {
      saveSession(payload.data);
    }
    return payload;
  },

  async register(userData) {
    const payload = await api("/auth/register", {
      method: "POST",
      auth: false,
      body: userData
    });
    // Registration now returns { token, user } just like login.
    // Save the session so the user is immediately authenticated.
    if (payload?.data?.token) {
      saveSession(payload.data);
    }
    return payload;
  },

  async getMe() {
    const payload = await api("/auth/me");
    if (payload?.data?.user) {
      const current = getSession();
      if (current?.token) {
        saveSession({ token: current.token, user: payload.data.user });
      }
    }
    return payload;
  },

  logout() {
    clearSession();
    window.dispatchEvent(new CustomEvent("vertex:session-expired"));
  }
};
