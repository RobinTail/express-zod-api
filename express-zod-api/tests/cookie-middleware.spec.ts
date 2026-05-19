import { createCookieMiddleware, testMiddleware } from "../src";
import { expect } from "vitest";

describe("Cookie middleware", () => {
  describe("createCookieMiddleware", () => {
    test("should create a Middleware instance", () => {
      const middleware = createCookieMiddleware();
      const { constructor } = Object.getPrototypeOf(middleware);
      expect(constructor.name).toBe("Middleware");
    });

    test.each([undefined, { httpOnly: true, secure: true, path: "/" }])(
      "should return setCookie and clearCookie helpers %#",
      async (baseOptions) => {
        const { output, responseMock } = await testMiddleware({
          middleware: createCookieMiddleware(baseOptions),
        });
        const { setCookie, clearCookie } = output as {
          setCookie: (typeof responseMock)["cookie"];
          clearCookie: (typeof responseMock)["clearCookie"];
        };
        expect(typeof setCookie).toBe("function");
        expect(typeof clearCookie).toBe("function");
        setCookie("session", "abc123", { httpOnly: false });
        expect(responseMock.cookies).toHaveProperty("session", {
          options: { ...baseOptions, httpOnly: false },
          value: "abc123",
        });
        clearCookie("session");
        expect(responseMock.cookies).toHaveProperty("session", {
          options: {
            ...baseOptions,
            path: "/",
            expires: expect.any(Date), // unstable
          },
          value: "",
        });
        expect(
          Number(responseMock.cookies["session"].options.expires),
        ).toBeLessThan(10); // usually 1
      },
    );
  });
});
