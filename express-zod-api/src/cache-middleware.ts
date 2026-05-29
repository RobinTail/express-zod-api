import { Middleware } from "./middleware";

/**
 * @desc Directives shared by both request and response Cache-Control headers.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#cache_directives
 */
interface CommonDirectives {
  /**
   * @desc Response: the response remains fresh for N seconds after it was generated.
   * @desc Request: the client will accept a stored response that was generated at most N seconds ago.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-age
   */
  maxAge?: number;
  /**
   * @desc Forces revalidation with the server before reuse.
   * @desc In a response this tells caches to revalidate; in a request it asks caches to revalidate.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
   */
  noCache?: boolean;
  /**
   * @desc Prevents storing the response in any cache. In a response this instructs caches not to store.
   * @desc In a request it asks caches not to store the request or its response.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
   */
  noStore?: boolean;
  /**
   * @desc Prevents intermediaries from transforming the response body (e.g. converting images).
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-transform
   */
  noTransform?: boolean;
  /**
   * @desc Allows a stale cached response to be reused for N seconds when the origin server returns an error.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#stale-if-error
   */
  staleIfError?: number;
}

/**
 * @desc Directives that clients send in requests to express their caching preferences.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#request_directives
 */
interface CacheControl extends CommonDirectives {
  /**
   * @desc The client will accept a stored response that is stale for up to N seconds beyond its freshness lifetime.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-stale
   */
  maxStale?: number;
  /**
   * @desc The client requires a stored response that will remain fresh for at least N more seconds.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#min-fresh
   */
  minFresh?: number;
  /**
   * @desc The client wants a response only from the cache. If no cached response is available, a 504 Gateway Timeout is returned.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#only-if-cached
   */
  onlyIfCached?: boolean;
}

/**
 * @desc Directives that servers send in responses to control how caches store and reuse the response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#response_directives
 */
interface CachePolicy extends CommonDirectives {
  /**
   * @desc Restricts which caches may store the response.
   * @example "public" — any cache (browser, proxy, CDN); for static assets, responses without user-specific data.
   * @example "private" — browser only; for user-specific and personalized content.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#response_directives
   */
  scope?: "public" | "private";
  /**
   * @desc Overrides max-age for shared caches (proxies, CDNs). Ignored by private (browser) caches.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#s-maxage
   */
  sMaxAge?: number;
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
   * @desc A cache must understand the caching requirements for the response's status code before storing it.
   * @desc Pair with no-store as a fallback for caches that don't support it.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#must-understand
   */
  mustUnderstand?: boolean;
  /**
   * @desc Indicates that the response body will never change while fresh.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable
   */
  immutable?: boolean;
  /**
   * @desc Allows a stale response to be served in the background while the cache revalidates it, for up to N seconds.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#stale-while-revalidate
   */
  staleWhileRevalidate?: number;
}

const formatCacheControl = (policy: CachePolicy): string => {
  const parts: string[] = [];
  if (policy.scope) parts.push(policy.scope);
  if (policy.noStore) parts.push("no-store");
  if (policy.noCache) parts.push("no-cache");
  if (policy.maxAge !== undefined) parts.push(`max-age=${policy.maxAge}`);
  if (policy.sMaxAge !== undefined) parts.push(`s-maxage=${policy.sMaxAge}`);
  if (policy.mustRevalidate) parts.push("must-revalidate");
  if (policy.proxyRevalidate) parts.push("proxy-revalidate");
  if (policy.mustUnderstand) parts.push("must-understand");
  if (policy.immutable) parts.push("immutable");
  if (policy.noTransform) parts.push("no-transform");
  if (policy.staleWhileRevalidate !== undefined)
    parts.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
  if (policy.staleIfError !== undefined)
    parts.push(`stale-if-error=${policy.staleIfError}`);
  return parts.join(", ");
};

type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

const numericDirectives = new Map<
  string,
  KeysOfType<Required<CacheControl>, number>
>([
  ["max-age", "maxAge"],
  ["max-stale", "maxStale"],
  ["min-fresh", "minFresh"],
  ["stale-if-error", "staleIfError"],
]);

const booleanDirectives = new Map<
  string,
  KeysOfType<Required<CacheControl>, boolean>
>([
  ["no-cache", "noCache"],
  ["no-store", "noStore"],
  ["no-transform", "noTransform"],
  ["only-if-cached", "onlyIfCached"],
]);

const parseCacheControl = (
  header: string | undefined,
): CacheControl | undefined => {
  if (!header) return undefined;
  const policy: CacheControl = {};
  for (const one of header.toLowerCase().split(",")) {
    const [name, raw] = one.split("=");
    const numericKey = numericDirectives.get(name.trim());
    if (numericKey) {
      const value = parseInt(raw?.trim() ?? "", 10);
      if (!isNaN(value)) policy[numericKey] = value;
      continue;
    }
    const booleanKey = booleanDirectives.get(name.trim());
    if (booleanKey) policy[booleanKey] = true;
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
         * @desc Reads and parses the If-None-Match request header into an array of ETags. Can also be '*' wildcard.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match
         */
        getIfNoneMatch: (): string[] | "*" | undefined => {
          const raw = request.headers["if-none-match"];
          if (!raw) return undefined;
          const trimmed = raw.trim();
          if (trimmed === "*") return trimmed;
          return trimmed.split(",").map((etag) =>
            etag
              .trim()
              .replace(/^(?:W\/)?"/, "")
              .replace(/"$/, ""),
          );
        },

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
         * @desc Reads and parses the Cache-Control request header to reveal the client's caching intent.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
         */
        getRequestCacheControl: (): CacheControl | undefined =>
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
