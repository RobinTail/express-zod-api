let cache: Set<string>;

export const wellKnownCookiesLastUpdated = "2026-09-04T00:00:00.000Z";

export const getWellKnownCookies = () =>
  (cache ??= new Set([
    "auth",
    "auth_token",
    "authToken",
    "csrf",
    "csrf-token",
    "csrfToken",
    "lang",
    "locale",
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
