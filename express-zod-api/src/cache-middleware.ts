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
   * @desc Forces the client to revalidate with the server on every request, even if the cached response is still fresh.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
   */
  noCache?: boolean;
  /**
   * @desc Prevents storing the response in cache at all. Consider noCache instead.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
   */
  noStore?: boolean;
  /**
   * @desc Forces all caches to revalidate stale responses with the origin server before reusing them.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#must-revalidate
   */
  mustRevalidate?: boolean;
  /**
   * @desc Forces proxies and CDNs to revalidate stale responses with the origin server before reusing them.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#proxy-revalidate
   */
  proxyRevalidate?: boolean;
  /**
   * @desc Indicates that the response body will never change.
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
  const directives = header
    .toLowerCase()
    .split(",")
    .map((one) => one.trim());
  const policy: CachePolicy = {};
  for (const directive of directives) {
    if (directive.startsWith("max-age")) {
      const value = parseInt(directive.split("=").pop()?.trim() ?? "", 10);
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
 * @desc Creates a Middleware providing caching helpers.
 * @param defaultPolicy — Optional default Cache-Control policy applied to all responses.
 * @example createCacheMiddleware({ noCache: true, scope: "private" })
 */
export const createCacheMiddleware = (defaultPolicy?: CachePolicy) =>
  new Middleware({
    handler: async ({ request, response }) => {
      if (defaultPolicy)
        response.setHeader("Cache-Control", formatCacheControl(defaultPolicy));

      return {
        /**
         * @desc Reads the If-None-Match request header containing the ETag of the client's cached copy.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match
         */
        getIfNoneMatch: (): string | undefined =>
          request.headers["if-none-match"],

        /**
         * @desc Reads and parses the If-Modified-Since request header having the timestamp of the client's cached copy.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Modified-Since
         */
        getIfModifiedSince: (): Date | undefined => {
          const value = request.headers["if-modified-since"];
          if (!value) return undefined;
          const date = new Date(value);
          return isNaN(date.getTime()) ? undefined : date;
        },

        /**
         * @desc Reads and parses the Cache-Control request header. This reveals the client's caching intent.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
         */
        getRequestCacheControl: (): CachePolicy | undefined =>
          parseCacheControl(request.headers["cache-control"]),

        /**
         * @desc Sets the Cache-Control response header to configure cache lifetime and revalidation behavior.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
         */
        setCachePolicy: (policy: CachePolicy): void => {
          response.setHeader("Cache-Control", formatCacheControl(policy));
        },

        /**
         * @desc Sets the ETag response header with a unique identifier for this version of the resource.
         * @see getIfNoneMatch
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
         */
        setETag: (value: string): void => {
          response.setHeader(
            "ETag",
            value.startsWith('"') ? value : `"${value}"`,
          );
        },

        /**
         * @desc Sets the Last-Modified response header to the timestamp when the resource was last changed.
         * @see getIfModifiedSince
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Last-Modified
         */
        setLastModified: (date: Date): void => {
          response.setHeader("Last-Modified", date.toUTCString());
        },

        /**
         * @desc Sets the Vary response header to the list of request headers that influence the response.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary
         */
        setVary: (...headers: string[]): void => {
          response.setHeader("Vary", headers.join(", "));
        },

        /**
         * @desc Sets the Expires response header with an explicit expiration date. Consider setCachePolicy({ maxAge }).
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires
         */
        setExpires: (date: Date): void => {
          response.setHeader("Expires", date.toUTCString());
        },

        /**
         * @desc Sets the Clear-Site-Data response header with the "cache" directive to remove all cached responses.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data
         */
        clearSiteData: (): void => {
          response.setHeader("Clear-Site-Data", '"cache"');
        },

        /**
         * @desc Sends an HTTP 304 Not Modified empty response and ends the response stream.
         * @see getIfNoneMatch
         * @see getIfModifiedSince
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/304
         */
        notModified: (): void => {
          response.status(304).end();
        },
      };
    },
  });
