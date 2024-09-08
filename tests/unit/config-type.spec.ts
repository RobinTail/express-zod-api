import { Express, IRouter } from "express";
import { createConfig } from "../../src";

describe("ConfigType", () => {
  describe("createConfig()", () => {
    test("should create a config with server", () => {
      const argument = {
        server: {
          listen: 3333,
        },
        cors: true,
        logger: { level: "debug" as const },
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });

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
        logger: { level: "silent" as const },
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });
  });
});
