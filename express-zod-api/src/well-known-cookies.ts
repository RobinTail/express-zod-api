/**
 * @desc Cookie names that we're certain about to be actual cookies (not query parameters)
 * @since v29.6.0
 * */
let cache: Set<string>;

export const getWellKnownCookies = () =>
  (cache ??= new Set(["session", "session_id", "sessionId"]));
