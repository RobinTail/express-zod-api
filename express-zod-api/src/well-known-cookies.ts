let cache: Set<string>;

/** @desc Cookie names that we're certain about to be actual cookies (not query parameters) */
export const getWellKnownCookies = () =>
  (cache ??= new Set(["session", "session_id", "sessionId"]));
