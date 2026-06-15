import { rateLimitMock } from "./peers-mock.ts";
import { createRateLimitMiddleware, testMiddleware } from "../src";

describe("Rate limit middleware", () => {
  describe("createRateLimitMiddleware", () => {
    beforeEach(() => {
      rateLimitMock.mockReset();
    });

    test("should create a Middleware instance", () => {
      const middleware = createRateLimitMiddleware();
      const { constructor } = Object.getPrototypeOf(middleware);
      expect(constructor.name).toBe("ExpressMiddleware");
    });

    test("should forward config to rateLimit function", () => {
      createRateLimitMiddleware({ windowMs: 60000, max: 10 });
      expect(rateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ windowMs: 60000, max: 10 }),
      );
      expect(rateLimitMock).toHaveBeenCalledTimes(1);
    });

    test("should include custom handler in options", () => {
      createRateLimitMiddleware({ message: "custom message" });
      const options = rateLimitMock.mock.calls[0]![0]!;
      expect(typeof options.handler).toBe("function");
    });

    test("should call next when within limit", async () => {
      rateLimitMock.mockReturnValue((_req: any, _res: any, next: any) => {
        next();
      });
      const { output } = await testMiddleware({
        middleware: createRateLimitMiddleware(),
      });
      expect(output).toEqual({});
    });

    test("should reject with 429 when limit exceeded", async () => {
      rateLimitMock.mockImplementation((options: any) => {
        return (req: any, res: any, next: any) => {
          options.handler(req, res, next, options);
        };
      });
      const { responseMock } = await testMiddleware({
        middleware: createRateLimitMiddleware({ message: "too fast" }),
      });
      expect(responseMock._getStatusCode()).toBe(429);
    });

    test("should populate ctx.rateLimit from request", async () => {
      const rateLimitInfo = {
        limit: 100,
        used: 1,
        remaining: 99,
        resetTime: new Date("2026-01-01T00:00:00Z"),
      };
      rateLimitMock.mockReturnValue((req: any, _res: any, next: any) => {
        req.rateLimit = rateLimitInfo;
        next();
      });
      const { output } = await testMiddleware({
        middleware: createRateLimitMiddleware(),
      });
      expect(output.rateLimit).toEqual(rateLimitInfo);
    });
  });
});
