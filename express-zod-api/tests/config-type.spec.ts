import type { Express, IRouter } from "express";
import { createConfig } from "../src";
import type {
  AppConfig,
  CommonConfig,
  InputSource,
  ServerConfig,
} from "../src/config-type";

describe("ConfigType", () => {
  test("types should satisfy", () => {
    expectTypeOf<{
      cors: true;
      logger: { level: "silent" };
    }>().toExtend<CommonConfig>();
    expectTypeOf<{
      app: IRouter;
      cors: true;
      logger: { level: "silent" };
    }>().toExtend<AppConfig>();
    expectTypeOf<{
      http: { listen: 1234 };
      logger: { level: "silent" };
      cors: false;
    }>().toExtend<ServerConfig>();
  });

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
});
