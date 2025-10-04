import type { Express, IRouter } from "express";
import { createConfig } from "../src/index.ts";

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
});
