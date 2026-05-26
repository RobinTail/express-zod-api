import {
  createCacheMiddleware,
  defaultEndpointsFactory,
  testEndpoint,
  testMiddleware,
} from "../src";
import { z } from "zod";

describe("Cache middleware", () => {
  describe("createCacheMiddleware", () => {
    test("should create a Middleware instance", () => {
      const middleware = createCacheMiddleware();
      const { constructor } = Object.getPrototypeOf(middleware);
      expect(constructor.name).toBe("Middleware");
    });

    describe("request getters", () => {
      test.each([
        ['"abc"', '"abc"'],
        [undefined, undefined],
      ] as const)(
        "getIfNoneMatch should return %s",
        async (header, expected) => {
          const { output } = await testMiddleware({
            middleware: createCacheMiddleware(),
            requestProps: {
              headers:
                header !== undefined ? { "if-none-match": header } : undefined,
            } as never,
          });
          const getter = output.getIfNoneMatch as () => string | undefined;
          expect(getter()).toBe(expected);
        },
      );

      test.each([
        ["Tue, 22 Feb 2022 22:00:00 GMT", new Date("2022-02-22T22:00:00Z")],
        [undefined, undefined],
        ["garbage", undefined],
      ] as const)(
        "getIfModifiedSince should return %s",
        async (header, expected) => {
          const { output } = await testMiddleware({
            middleware: createCacheMiddleware(),
            requestProps: {
              headers:
                header !== undefined
                  ? { "if-modified-since": header }
                  : undefined,
            } as never,
          });
          const getter = output.getIfModifiedSince as () => Date | undefined;
          const result = getter();
          if (expected instanceof Date) {
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(expected.getTime());
          } else {
            expect(result).toBeUndefined();
          }
        },
      );

      test.each([
        ["public, max-age=3600", { maxAge: 3600, scope: "public" }],
        ["no-cache, private", { noCache: true, scope: "private" }],
        [
          "no-store, no-cache, must-revalidate",
          { noStore: true, noCache: true, mustRevalidate: true },
        ],
        [
          "proxy-revalidate, immutable",
          { proxyRevalidate: true, immutable: true },
        ],
        [undefined, undefined],
        ["", undefined],
        ["no-cache, no-transform, only-if-cached", { noCache: true }],
        ["max-age=abc", {}],
      ] as const)(
        "getRequestCacheControl should parse %s",
        async (header, expected) => {
          const { output } = await testMiddleware({
            middleware: createCacheMiddleware(),
            requestProps: {
              headers:
                header !== undefined ? { "cache-control": header } : undefined,
            } as never,
          });
          const getter = output.getRequestCacheControl as () =>
            | Record<string, unknown>
            | undefined;
          expect(getter()).toEqual(expected);
        },
      );
    });

    describe("response setters", () => {
      test.each([
        [{ maxAge: 3600, scope: "public" }, "public, max-age=3600"],
        [{ noCache: true }, "no-cache"],
        [{ noCache: true, scope: "private" }, "private, no-cache"],
        [{ noStore: true }, "no-store"],
        [
          {
            noStore: true,
            noCache: true,
            mustRevalidate: true,
            proxyRevalidate: true,
          },
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        ],
        [
          { maxAge: 31536000, scope: "public", immutable: true },
          "public, max-age=31536000, immutable",
        ],
      ])(
        "setCachePolicy(%j) should set cache-control to %s",
        async (policy, expected) => {
          const { output, responseMock } = await testMiddleware({
            middleware: createCacheMiddleware(),
          });
          const setter = output.setCachePolicy as (p: unknown) => void;
          setter(policy);
          expect(responseMock._getHeaders()).toHaveProperty(
            "cache-control",
            expected,
          );
        },
      );

      test.each([
        ["setETag", ["abc"], "etag", '"abc"'],
        ["setETag", ['"abc"'], "etag", '"abc"'],
        [
          "setLastModified",
          [new Date("2022-02-22T22:00:00Z")],
          "last-modified",
          "Tue, 22 Feb 2022 22:00:00 GMT",
        ],
        [
          "setExpires",
          [new Date("2022-02-28T22:22:22Z")],
          "expires",
          "Mon, 28 Feb 2022 22:22:22 GMT",
        ],
        ["clearSiteData", [], "clear-site-data", '"cache"'],
      ] as const)(
        "%s should set %s header",
        async (method, args, header, expected) => {
          const { output, responseMock } = await testMiddleware({
            middleware: createCacheMiddleware(),
          });
          const setter = output[method] as (...args: unknown[]) => void;
          setter(...args);
          expect(responseMock._getHeaders()).toHaveProperty(header, expected);
        },
      );

      test.each([
        [["Accept-Language"], "Accept-Language"],
        [
          ["Accept-Language", "Accept-Encoding"],
          "Accept-Language, Accept-Encoding",
        ],
      ])("setVary(%j) should set vary header", async (headers, expected) => {
        const { output, responseMock } = await testMiddleware({
          middleware: createCacheMiddleware(),
        });
        const setter = output.setVary as (...h: string[]) => void;
        setter(...headers);
        expect(responseMock._getHeaders()).toHaveProperty("vary", expected);
      });
    });

    describe("notModified", () => {
      test("should send 304 and end the response", async () => {
        const { output, responseMock } = await testMiddleware({
          middleware: createCacheMiddleware(),
        });
        const notModified = output.notModified as () => void;
        notModified();
        expect(responseMock._getStatusCode()).toBe(304);
        expect(responseMock.writableEnded).toBeTruthy();
      });

      test("should prevent output validation after 304", async () => {
        const endpoint = defaultEndpointsFactory
          .addMiddleware(createCacheMiddleware())
          .build({
            method: "get",
            output: z.object({}),
            handler: async ({ ctx }) => {
              (ctx as { notModified: () => void }).notModified();
              return {} as never;
            },
          });
        const { responseMock } = await testEndpoint({ endpoint });
        expect(responseMock._getStatusCode()).toBe(304);
        expect(responseMock.writableEnded).toBeTruthy();
      });
    });

    describe("default policy", () => {
      test("should apply Cache-Control when no setCachePolicy is called", async () => {
        const { responseMock } = await testMiddleware({
          middleware: createCacheMiddleware({
            noCache: true,
            scope: "private",
          }),
          requestProps: {} as never,
        });
        expect(responseMock._getHeaders()).toHaveProperty(
          "cache-control",
          "private, no-cache",
        );
      });

      test("should be overridden by explicit setCachePolicy call", async () => {
        const { output, responseMock } = await testMiddleware({
          middleware: createCacheMiddleware({
            noCache: true,
            scope: "private",
          }),
          requestProps: {} as never,
        });
        const setter = output.setCachePolicy as (p: unknown) => void;
        setter({ maxAge: 3600, scope: "public" });
        expect(responseMock._getHeaders()).toHaveProperty(
          "cache-control",
          "public, max-age=3600",
        );
      });
    });
  });
});
