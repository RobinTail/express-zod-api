import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tryCatch } from "ramda";
import { z } from "zod";

/**
 * @link https://chatgpt.com/c/6795dae3-8a10-800e-96af-fd0d01579f39
 * @link https://gemini.google.com/app/b47e9022a51a9846
 * */
const responseOnlyHeaders = {
  "accept-patch": {
    proof:
      "Defined in RFC 5789, Section 3.1. Used by the server to indicate supported PATCH media types.",
    reason:
      "Servers use this header in responses to inform clients about supported PATCH formats.",
  },
  "accept-post": {
    proof: "Part of the WebDAV specification (RFC 7240, Section 4).",
    reason:
      "Sent in responses to indicate the types of POST requests that a server supports.",
  },
  "accept-ranges": {
    proof: "Defined in RFC 7233, Section 2.3.",
    reason:
      "The server uses this to tell the client it supports partial requests (e.g., byte ranges).",
  },
  "access-control-allow-credentials": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason: "Used in responses to indicate support for credentials in CORS.",
  },
  "access-control-allow-headers": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason: "Specifies allowed headers in preflight CORS responses.",
  },
  "access-control-allow-methods": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason: "Specifies allowed HTTP methods in preflight CORS responses.",
  },
  "access-control-allow-origin": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason: "Indicates allowed origins for CORS requests.",
  },
  "access-control-expose-headers": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason: "Lists headers exposed to the client in CORS responses.",
  },
  "access-control-max-age": {
    proof: "Defined in CORS Specification (Fetch Standard, Section 6.2).",
    reason:
      "Specifies how long preflight results can be cached in CORS responses.",
  },
  "activate-storage-access": {
    reason: "response header",
    proof:
      "https://developers.google.com/privacy-sandbox/blog/storage-access-api-headers-logic",
  },
  age: {
    proof: "Defined in RFC 7234, Section 5.1.",
    reason:
      "Indicates the age of a cached response, a concept relevant only to responses.",
  },
  allow: {
    proof: "Defined in RFC 7231, Section 7.4.1.",
    reason: "Used in responses to indicate supported methods for the resource.",
  },
  "alt-svc": {
    proof: "Defined in RFC 7838, Section 3.",
    reason: "The server advertises alternative services in responses.",
  },
  "cache-status": {
    proof: "Defined in RFC 9211.",
    reason: "Indicates the status of caching for the response.",
  },
  "cdn-cache-control": {
    proof:
      "An extension header often used by CDNs to communicate caching strategies; see examples in CDN-specific docs (e.g., Akamai or Cloudflare).",
    reason: "Relevant to response caching.",
  },
  "cdn-loop": {
    proof: "Defined in RFC 8586, Section 2.",
    reason:
      "Used to detect infinite loops within CDNs; appears only in responses.",
  },
  "clear-site-data": {
    description: "Instructs the user agent to clear browsing data.",
    proof: "RFC 7873: Server instructs client to clear data.",
  },
  "content-base": {
    proof:
      "Mentioned in early HTTP/1.1 specs (e.g., RFC 2068, Section 14.11). Deprecated, but applies only to server responses.",
    reason: "Specifies the base URL for relative URLs in a document.",
  },
  "content-security-policy": {
    proof: "Defined in the CSP Specification.",
    reason:
      "Used to define security policies for the content delivered in the response.",
  },
  "content-security-policy-report-only": {
    proof: "Defined in the CSP Specification.",
    reason: "A response-only variant of the CSP header for testing purposes.",
  },
  "content-style-type": {
    proof:
      "Deprecated but mentioned in early specifications (e.g., HTML 4.01).",
    reason:
      "Indicates the default stylesheet language; used in responses only.",
  },
  "content-version": {
    proof: "Part of early HTTP/1.1 drafts (e.g., RFC 2068, Section 14.14).",
    reason: "Specifies the version of the returned content; response-only.",
  },
  etag: {
    proof: "Defined in RFC 7232, Section 2.3.",
    reason:
      "Used to identify the version of a resource; relevant only to responses.",
  },
  expires: {
    proof: "Defined in RFC 7234, Section 5.3.",
    reason: "Indicates when the response content becomes stale.",
  },
  "last-modified": {
    proof: "Defined in RFC 7232, Section 2.2.",
    reason: "Communicates the last modification date of the resource.",
  },
  location: {
    proof: "Defined in RFC 7231, Section 7.1.2.",
    reason:
      "Used in redirection responses or to indicate the location of a created resource.",
  },
  "optional-www-authenticate": {
    proof: "Defined in RFC 8053, Section 3.",
    reason: "Allows a server to provide optional authentication mechanisms.",
  },
  "proxy-authenticate": {
    proof: "Defined in RFC 7235, Section 4.3.",
    reason: "Used in responses for proxy authentication.",
  },
  "proxy-authentication-info": {
    proof: "Defined in RFC 7615, Section 3.",
    reason:
      "Used by the server to provide information about proxy authentication.",
  },
  "proxy-status": {
    proof: "Defined in RFC 8586, Section 5.6.",
    reason: "Communicates proxy-specific status information in responses.",
  },
  refresh: {
    proof: "A non-standard but widely used header (MDN Docs).",
    reason: "Indicates redirection or automatic page refresh.",
  },
  "retry-after": {
    proof: "Defined in RFC 7231, Section 7.1.3.",
    reason:
      "Used in responses to indicate when the client should retry a request.",
  },
  "sec-websocket-accept": {
    proof: "Defined in RFC 6455, Section 11.3.3.",
    reason: "Used in WebSocket handshake responses to confirm acceptance.",
  },
  server: {
    proof: "Defined in RFC 7231, Section 7.4.2.",
    reason: "Identifies the server software handling the response.",
  },
  "server-timing": {
    proof: "Defined in W3C Server Timing Specification.",
    reason: "Provides server-side timing metrics in responses.",
  },
  "set-cookie": {
    proof: "Defined in RFC 6265, Section 4.1.",
    reason: "Used to set cookies in responses.",
  },
  "set-cookie2": {
    proof:
      "Deprecated but appeared in earlier specs like RFC 2965, Section 3.3.3.",
    reason: "A legacy header for setting cookies.",
  },
  "strict-transport-security": {
    proof: "Defined in RFC 6797, Section 6.1.",
    reason: "Enforces HTTPS policies in responses.",
  },
  "surrogate-control": {
    proof: "Defined in CDN-specific documentation (e.g., Akamai, Cloudflare).",
    reason: "Used to manage CDN-specific cache behavior in responses.",
  },
  "timing-allow-origin": {
    proof: "Defined in the Resource Timing Level 1 Spec.",
    reason:
      "Specifies which origins can access timing information in the response.",
  },
  vary: {
    description:
      "Tells caches that the response is variant and lists the headers that determine the variance.",
    proof: "RFC 9110, 15.8: Server specifies response variations.",
  },
  "www-authenticate": {
    proof: "Defined in RFC 7235, Section 4.1.",
    reason: "Used in responses for authentication challenges.",
  },
};

const dest = "express-zod-api/src/well-known-headers.json";
const mtime = tryCatch(
  (cmd) => new Date(execSync(cmd, { encoding: "utf8" })),
  () => undefined,
)(`git log -1 --pretty="format:%ci" ${dest}`);

console.info("Current state", mtime);

/**
 * @link https://www.iana.org/assignments/http-fields/http-fields.xhtml
 * @example https://github.com/ladjs/message-headers/blob/master/cron.js
 */
const response = await fetch(
  "https://www.iana.org/assignments/http-fields/field-names.csv",
);
const lastMod = response.headers.get("last-modified");
if (!lastMod)
  throw new Error("Can not get Last-Modified headers from response");
const state = new Date(lastMod);
console.info("Last modified", state);
if (mtime && state <= mtime) process.exit(0);

const csv = await response.text();

const categories = [
  "permanent",
  "deprecated",
  "provisional",
  "obsoleted",
] as const;

const schema = z.object({
  name: z.string().regex(/^[\w-]+$/),
  category: z.enum(categories),
});

const lines = csv.split("\n").slice(1, -1);
const headers = lines
  .map((line) => {
    const [name, category] = line.split(",").slice(0, 2);
    return { name, category };
  })
  .filter((entry) => {
    const { success } = schema.safeParse(entry);
    if (!success) console.debug("excluding", entry);
    return success;
  })
  .map(({ name }) => name.toLowerCase())
  .filter((name) => !(name in responseOnlyHeaders));

console.debug("CRC:", headers.length);

await writeFile(dest, JSON.stringify(headers, undefined, 2), "utf-8");
