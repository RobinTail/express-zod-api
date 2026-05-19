import type { Express, IRouter } from "express";
import { createConfig } from "../src";
import type { InputSource, ServerConfig } from "../src/config-type";

describe("ConfigType", () => {
  describe("createConfig()", () => {
    const httpConfig = { http: { listen: 3333 } };
    const httpsConfig = { https: { options: {}, listen: 4444 } };
    const both = { ...httpConfig, ...httpsConfig };

    test.each([httpConfig, httpsConfig, both])(
      "should create a config with server %#",
      (inc) => {
        const argument = {
          ...inc,
          cors: true,
          logger: { level: "debug" as const },
        };
        const config = createConfig(argument);
        expect(config).toEqual(argument);
      },
    );

    test("should create a config with app", () => {
      const argument = {
        app: vi.fn() as unknown as Express,
        cors: true,
        logger: console,
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });

    test("should create a config with router", () => {
      const argument = {
        app: vi.fn() as unknown as IRouter,
        cors: true,
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });
  });

  describe("InputSource", () => {
    test("should list the selected properties of Request", () => {
      expectTypeOf<InputSource>().toEqualTypeOf<
        | "query"
        | "body"
        | "files"
        | "params"
        | "headers"
        | "cookies"
        | "signedCookies"
      >();
    });
  });

  describe("ServerConfig cookies", () => {
    test.each([true, false, undefined])("should accept boolean %s", (value) => {
      const config: ServerConfig = {
        cors: true,
        cookies: value,
      } as ServerConfig;
      expect(config.cookies).toBe(value);
    });

    test("should accept CookieParserOptions with secret", () => {
      const config: ServerConfig = {
        cors: true,
        cookies: { secret: "my-secret" },
      } as ServerConfig;
      expect(config.cookies).toEqual({ secret: "my-secret" });
    });

    test("should accept CookieParserOptions with decode", () => {
      const decode = () => "decoded";
      const config: ServerConfig = {
        cors: true,
        cookies: { decode },
      } as ServerConfig;
      expect(config.cookies).toEqual({ decode });
    });

    test("should accept CookieParserOptions with both options", () => {
      const config: ServerConfig = {
        cors: true,
        cookies: { secret: "s", decode: (v: string) => v },
      } as ServerConfig;
      expect(config.cookies).toEqual({
        secret: "s",
        decode: expect.any(Function),
      });
    });
  });
});
