import { Middleware } from "./middleware";

/**
 * @desc Directives to configure how browsers, proxies, and CDNs cache the response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
 */
interface CachePolicy {
  /**
   * @desc After this time (in seconds) the cached response is considered stale and must be revalidated or re-fetched.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-age
   */
  maxAge?: number;
  /**
   * @desc Restricts which caches may store the response.
   * @example "public" — any cache (browser, proxy, CDN); for static assets, responses without user-specific data.
   * @example "private" — browser only; for user-specific and personalized content.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#response_directives
   */
  scope?: "public" | "private";
  /**
   * @desc Forces the client to revalidate with the server on every request, even if the cached response is still fresh. The server returns 304 Not Modified if the content hasn't changed, saving bandwidth while ensuring the client always gets the latest version.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
   */
  noCache?: boolean;
  /**
   * @desc Prevents caches from storing the response at all. Use sparingly — prefer noCache instead when possible, because it preserves back/forward navigation cache and reduces server load through conditional requests.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
   */
  noStore?: boolean;
  /**
   * @desc Forces caches to revalidate stale responses with the origin server before reusing them. Without this, caches may serve stale data in certain circumstances.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#must-revalidate
   */
  mustRevalidate?: boolean;
  /**
   * @desc Same as mustRevalidate, but applies only to shared caches (proxies and CDNs), not to browser caches.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#proxy-revalidate
   */
  proxyRevalidate?: boolean;
  /**
   * @desc Indicates that the response body will never change. Used together with a long max-age on cache-busted static assets (e.g. bundle.a1b2c3.js). This tells the browser it never needs to revalidate, even on reload.
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

/**
 * @desc Creates a Middleware providing caching helpers for setting Cache-Control, ETag, Last-Modified, Vary, Expires, Clear-Site-Data headers and sending 304 Not Modified responses.
 * @param defaultPolicy — Optional default Cache-Control policy applied when no setCachePolicy() is called in the handler.
 * @example createCacheMiddleware({ noCache: true, scope: "private" })
 */
export const createCacheMiddleware = (defaultPolicy?: CachePolicy) =>
  new Middleware({
    handler: async ({ request, response }) => {
      if (defaultPolicy)
        response.setHeader("Cache-Control", formatCacheControl(defaultPolicy));

      return {
        /**
         * @desc Reads the If-None-Match request header containing the ETag of the client's cached copy. When the ETag matches the current resource, the server can respond with 304 Not Modified to save bandwidth.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match
         */
        getIfNoneMatch: (): string | undefined =>
          request.headers["if-none-match"] as string | undefined,

        /**
         * @desc Reads and parses the If-Modified-Since request header containing the timestamp of the client's cached copy into a Date object (invalid or missing dates return undefined). Compare this to the current Last-Modified to decide whether to return 304 Not Modified.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Modified-Since
         */
        getIfModifiedSince: (): Date | undefined => {
          const value = request.headers["if-modified-since"];
          if (!value) return undefined;
          const date = new Date(value);
          return isNaN(date.getTime()) ? undefined : date;
        },

        /**
         * @desc Reads and parses the request's Cache-Control header into a CachePolicy object. This reveals the client's caching intent — for example max-age=0 during a normal browser reload, or no-cache during a force reload.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
         */
        getRequestCacheControl: (): CachePolicy | undefined =>
          parseCacheControl(
            request.headers["cache-control"] as string | undefined,
          ),

        /**
         * @desc Sets the Cache-Control response header to control how (and for how long) browsers, proxies and CDNs may cache this response. Use the CachePolicy to configure max-age (freshness lifetime), scope (public vs private), and revalidation behavior.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
         */
        setCachePolicy: (policy: CachePolicy): void => {
          response.setHeader("Cache-Control", formatCacheControl(policy));
        },

        /**
         * @desc Sets the ETag response header with a unique identifier for this version of the resource. On subsequent requests the browser sends this value back in If-None-Match; if it matches, the server can return 304 Not Modified instead of re-sending the payload. Bare values are automatically wrapped in double quotes per the HTTP spec.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
         */
        setETag: (value: string): void => {
          response.setHeader(
            "ETag",
            value.startsWith('"') ? value : `"${value}"`,
          );
        },

        /**
         * @desc Sets the Last-Modified response header to the timestamp when the resource was last changed. On subsequent requests the browser sends this back in If-Modified-Since; if the resource hasn't changed, the server can return 304 Not Modified. Accepts a Date object, converted to HTTP-date format internally.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Last-Modified
         */
        setLastModified: (date: Date): void => {
          response.setHeader("Last-Modified", date.toUTCString());
        },

        /**
         * @desc Sets the Vary response header to list which request headers influence the response representation. This prevents caches from serving a response intended for one language (Accept-Language) or encoding (Accept-Encoding) to a client expecting another. Accepts one or more header names, joined by commas.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary
         */
        setVary: (...headers: string[]): void => {
          response.setHeader("Vary", headers.join(", "));
        },

        /**
         * @desc Sets the Expires response header with an explicit expiration date (legacy HTTP/1.0 header). When both Expires and Cache-Control max-age are present, max-age takes precedence. Prefer setCachePolicy for modern applications. Accepts a Date object.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires
         */
        setExpires: (date: Date): void => {
          response.setHeader("Expires", date.toUTCString());
        },

        /**
         * @desc Sets the Clear-Site-Data response header with the "cache" directive, instructing the browser to remove all cached responses for the origin. Useful after logout, settings changes, or when the user's data is updated.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data
         */
        clearSiteData: (): void => {
          response.setHeader("Clear-Site-Data", '"cache"');
        },

        /**
         * @desc Sends an HTTP 304 Not Modified response with no body and ends the response stream. Use this when the client's cached copy (identified via If-None-Match or If-Modified-Since) is still valid. The handler must return after calling this, which stops further processing (output validation and response serialization are skipped).
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/304
         */
        notModified: (): void => {
          response.status(304).end();
        },
      };
    },
  });
