import { createCookieMiddleware } from "../src";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";

const execute = async (baseOptions?: import("express").CookieOptions) => {
  const middleware = createCookieMiddleware(baseOptions);
  const logger = makeLoggerMock();
  const request = makeRequestMock();
  const response = makeResponseMock();
  const ctx = await middleware.execute({
    input: {},
    ctx: {},
    logger,
    request,
    response,
  });
  return { ctx, response };
};

describe("Cookie middleware", () => {
  describe("createCookieMiddleware", () => {
    test("should create a Middleware instance", () => {
      const middleware = createCookieMiddleware();
      const { constructor } = Object.getPrototypeOf(middleware);
      expect(constructor.name).toBe("Middleware");
    });

    test("should return setCookie and clearCookie in context", async () => {
      const { ctx } = await execute();
      expect(ctx).toHaveProperty("setCookie");
      expect(typeof ctx.setCookie).toBe("function");
      expect(ctx).toHaveProperty("clearCookie");
      expect(typeof ctx.clearCookie).toBe("function");
    });

    test("setCookie without base options should pass empty object fallback", async () => {
      const { ctx, response } = await execute();
      const spy = vi.spyOn(response, "cookie");
      ctx.setCookie("session", "abc123");
      expect(spy).toHaveBeenCalledWith("session", "abc123", {});
    });

    test("setCookie should merge per-call options over base options", async () => {
      const { ctx, response } = await execute({
        httpOnly: true,
        secure: true,
        path: "/",
      });
      const spy = vi.spyOn(response, "cookie");
      ctx.setCookie("session", "abc123", { httpOnly: false });
      expect(spy).toHaveBeenCalledWith("session", "abc123", {
        httpOnly: false,
        secure: true,
        path: "/",
      });
    });

    test("clearCookie should use base options", async () => {
      const { ctx, response } = await execute({ path: "/" });
      const spy = vi.spyOn(response, "clearCookie");
      ctx.clearCookie("session");
      expect(spy.mock.calls[0][0]).toBe("session");
      expect(spy.mock.calls[0][1]).toMatchObject({ path: "/" });
    });
  });
});
