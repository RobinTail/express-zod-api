import { createCacheMiddleware, testMiddleware } from "../src";

describe("Cache middleware", () => {
  describe("createCacheMiddleware", () => {
    test("should create a Middleware instance", () => {
      const middleware = createCacheMiddleware();
      const { constructor } = Object.getPrototypeOf(middleware);
      expect(constructor.name).toBe("Middleware");
    });

    describe("request getters", () => {
      test.each([
        ['"abc"', ["abc"]],
        ['"abc", "def"', ["abc", "def"]],
        ["*", "*"],
        ['W/"abc"', ["abc"]],
        [undefined, undefined],
      ])("getIfNoneMatch should return %s", async (header, expected) => {
        const { output } = await testMiddleware({
          middleware: createCacheMiddleware(),
          requestProps: {
            headers:
              header !== undefined ? { "if-none-match": header } : undefined,
          } as never,
        });
        const getter = output.getIfNoneMatch as () =>
          | string[]
          | "*"
          | undefined;
        expect(getter()).toEqual(expected);
      });

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
        ["max-age=3600", { maxAge: 3600 }],
        ["max-age = 3600", { maxAge: 3600 }],
        ["max-age= 3600", { maxAge: 3600 }],
        ["max-age =3600", { maxAge: 3600 }],
        ["max-age = ", {}],
        ["no-cache", { noCache: true }],
        ["no-store, no-cache", { noStore: true, noCache: true }],
        ["no-transform", { noTransform: true }],
        [
          "no-transform, only-if-cached",
          { noTransform: true, onlyIfCached: true },
        ],
        ["max-stale=3600", { maxStale: 3600 }],
        ["min-fresh=600", { minFresh: 600 }],
        ["stale-if-error=86400", { staleIfError: 86400 }],
        [undefined, undefined],
        ["", undefined],
        [
          "no-cache, no-transform, only-if-cached",
          { noCache: true, noTransform: true, onlyIfCached: true },
        ],
        ["max-age=abc", {}],
        ["public", {}],
        ["private", {}],
        ["must-revalidate", {}],
        ["proxy-revalidate", {}],
        ["immutable", {}],
        ["Max-Age=3600", { maxAge: 3600 }],
        ["NO-CACHE", { noCache: true }],
        ["No-Store, No-Transform", { noStore: true, noTransform: true }],
        ["MAX-STALE=600", { maxStale: 600 }],
        [
          "No-Cache, No-Transform, Only-If-Cached",
          { noCache: true, noTransform: true, onlyIfCached: true },
        ],
        ["MIXED-no-Store", {}],
        ["max-stale=, MAX-AGE=3600", { maxAge: 3600 }],
        ["Max-Age = 3600", { maxAge: 3600 }],
      ])("getCacheControl should parse %s", async (header, expected) => {
        const { output } = await testMiddleware({
          middleware: createCacheMiddleware(),
          requestProps: {
            headers:
              header !== undefined ? { "cache-control": header } : undefined,
          } as never,
        });
        const getter = output.getCacheControl as () =>
          | Record<string, unknown>
          | undefined;
        expect(getter()).toEqual(expected);
      });
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
        [{ sMaxAge: 3600 }, "s-maxage=3600"],
        [{ mustUnderstand: true }, "must-understand"],
        [{ noTransform: true }, "no-transform"],
        [{ staleWhileRevalidate: 86400 }, "stale-while-revalidate=86400"],
        [{ staleIfError: 86400 }, "stale-if-error=86400"],
        [
          {
            mustRevalidate: true,
            mustUnderstand: true,
            noTransform: true,
            staleWhileRevalidate: 60,
            staleIfError: 120,
          },
          "must-revalidate, must-understand, no-transform, stale-while-revalidate=60, stale-if-error=120",
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
