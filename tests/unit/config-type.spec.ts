import { Express } from "express";
import { createConfig } from "../../src";

describe("ConfigType", () => {
  describe("createConfig()", () => {
    test("should create a config with server", () => {
      const argument = {
        server: {
          listen: 3333,
        },
        cors: true,
        logger: {
          level: "debug" as const,
          color: false,
        },
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });

    test("should create a config with app", () => {
      const argument = {
        app: jest.fn() as unknown as Express,
        cors: true,
        logger: {
          level: "debug" as const,
          color: false,
        },
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });
  });
});
