interface CachePolicy {
  /**
   * @desc The freshness lifetime in seconds. After this time the cached response is considered stale and must be revalidated or re-fetched.
   * @default undefined — no max-age is set, cache lifetime is determined by other directives or heuristic caching
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-age
   */
  maxAge?: number;
  /**
   * @desc Restricts which caches may store the response. "public" allows any cache (browser, proxy, CDN). "private" restricts to the browser only — use for responses containing personalized or user-specific content.
   * @default undefined — scope is omitted, cacheability depends on other directives
   * @example "public" — suitable for static assets, API responses without user-specific data
   * @example "private" — suitable for user profiles, dashboards, authenticated content
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#response_directives
   */
  scope?: "public" | "private";
  /**
   * @desc Forces the client to revalidate with the server on every request, even if the cached response is still fresh. The server returns 304 Not Modified if the content hasn't changed, saving bandwidth while ensuring the client always gets the latest version.
   * @default undefined — revalidation is not forced
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
   */
  noCache?: boolean;
  /**
   * @desc Prevents caches from storing the response at all. Use sparingly — prefer noCache instead when possible, because it preserves back/forward navigation cache and reduces server load through conditional requests.
   * @default undefined — storage is not prevented
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
   */
  noStore?: boolean;
  /**
   * @desc Forces caches to revalidate stale responses with the origin server before reusing them. Without this, caches may serve stale data in certain circumstances.
   * @default undefined — caches may serve stale responses under their own heuristics
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#must-revalidate
   */
  mustRevalidate?: boolean;
  /**
   * @desc Same as mustRevalidate, but applies only to shared caches (proxies and CDNs), not to browser caches.
   * @default undefined — shared caches are not forced to revalidate
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#proxy-revalidate
   */
  proxyRevalidate?: boolean;
  /**
   * @desc Indicates that the response body will never change. Used together with a long max-age on cache-busted static assets (e.g. bundle.a1b2c3.js). This tells the browser it never needs to revalidate, even on reload.
   * @default undefined — the resource is not considered immutable
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable
   */
  immutable?: boolean;
}

const formatCacheControl = (policy: CachePolicy): string => {
  const parts: string[] = [];
  if (policy.scope) parts.push(policy.scope);
  if (policy.noStore) parts.push("no-store");
  if (policy.noCache) parts.push("no-cache");
  if (policy.maxAge !== undefined) parts.push(`max-age=${policy.maxAge}`);
  if (policy.mustRevalidate) parts.push("must-revalidate");
  if (policy.proxyRevalidate) parts.push("proxy-revalidate");
  if (policy.immutable) parts.push("immutable");
  return parts.join(", ");
};

const parseCacheControl = (
  header: string | undefined,
): CachePolicy | undefined => {
  if (!header) return undefined;
  const directives = header.split(",").map((d) => d.trim().toLowerCase());
  if (directives.length === 0) return undefined;
  const policy: CachePolicy = {};
  for (const directive of directives) {
    if (directive.startsWith("max-age=")) {
      const value = parseInt(directive.slice(8), 10);
      if (!isNaN(value)) policy.maxAge = value;
    } else if (directive === "public") {
      policy.scope = "public";
    } else if (directive === "private") {
      policy.scope = "private";
    } else if (directive === "no-cache") {
      policy.noCache = true;
    } else if (directive === "no-store") {
      policy.noStore = true;
    } else if (directive === "must-revalidate") {
      policy.mustRevalidate = true;
    } else if (directive === "proxy-revalidate") {
      policy.proxyRevalidate = true;
    } else if (directive === "immutable") {
      policy.immutable = true;
    }
  }
  return policy;
};
