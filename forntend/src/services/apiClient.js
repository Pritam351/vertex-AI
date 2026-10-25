
import { API_BASE_URL } from "./config.js";
import { clearSession, getSession } from "../store/session.js";

export class ApiError extends Error {
    constructor(message, { status = 0, errors = [] } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.errors = errors;
    }
}

export async function api(
    path,
    { method = "GET", body, auth = true, signal } = {}
) {
    const headers = { Accept: "application/json" };
    const session = getSession();

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (auth && session?.token) {
        headers.Authorization = `Bearer ${session.token}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal
        });
    } catch {
        throw new ApiError(
            "We could not reach the LMS API. Check that the backend is running and try again."
        );
    }

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        throw new ApiError("The API returned an unreadable response.", {
            status: response.status
        });
    }

    if (!response.ok) {
        if (response.status === 401 && auth) {
            clearSession();
            window.dispatchEvent(new CustomEvent("vertex:session-expired"));
        }

        throw new ApiError(
            payload?.message || "The request could not be completed.",
            {
                status: response.status,
                errors: payload?.errors || []
            }
        );
    }

    return payload;
}
