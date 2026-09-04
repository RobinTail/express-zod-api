let cache: Set<string>;

export const getWellKnownCookies = () =>
  (cache ??= new Set([
    "auth",
    "auth_token",
    "authToken",
    "csrf",
    "csrf-token",
    "csrfToken",
    "preferences",
    "prefs",
    "remember-me",
    "remember",
    "session",
    "session_id",
    "sessionId",
    "theme",
    "token",
    "xsrf",
  ]));
