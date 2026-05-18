import { cookieMiddleware } from "../src";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";

describe("Cookie middleware", () => {
  describe("cookieMiddleware", () => {
    test("should be an instance of Middleware", () => {
      const { constructor } = Object.getPrototypeOf(cookieMiddleware);
      expect(constructor.name).toBe("Middleware");
    });

    test("should return setCookie and clearCookie in context", async () => {
      const logger = makeLoggerMock();
      const request = makeRequestMock();
      const response = makeResponseMock();
      const ctx = await cookieMiddleware.execute({
        input: {},
        ctx: {},
        logger,
        request,
        response,
      });
      expect(ctx).toHaveProperty("setCookie");
      expect(typeof ctx.setCookie).toBe("function");
      expect(ctx).toHaveProperty("clearCookie");
      expect(typeof ctx.clearCookie).toBe("function");
    });

    test("setCookie should delegate to response.cookie", async () => {
      const logger = makeLoggerMock();
      const request = makeRequestMock();
      const response = makeResponseMock();
      const spy = vi.spyOn(response, "cookie");
      const ctx = await cookieMiddleware.execute({
        input: {},
        ctx: {},
        logger,
        request,
        response,
      });
      ctx.setCookie("session", "abc123", { httpOnly: true, path: "/" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("session", "abc123", {
        httpOnly: true,
        path: "/",
      });
    });

    test("clearCookie should delegate to response.clearCookie", async () => {
      const logger = makeLoggerMock();
      const request = makeRequestMock();
      const response = makeResponseMock();
      const spy = vi.spyOn(response, "clearCookie");
      const ctx = await cookieMiddleware.execute({
        input: {},
        ctx: {},
        logger,
        request,
        response,
      });
      ctx.clearCookie("session", { path: "/" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe("session");
      expect(spy.mock.calls[0][1]).toMatchObject({ path: "/" });
    });

    test("setCookie should work without options", async () => {
      const logger = makeLoggerMock();
      const request = makeRequestMock();
      const response = makeResponseMock();
      const spy = vi.spyOn(response, "cookie");
      const ctx = await cookieMiddleware.execute({
        input: {},
        ctx: {},
        logger,
        request,
        response,
      });
      ctx.setCookie("session", "abc123");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("session", "abc123", {});
    });
  });
});
