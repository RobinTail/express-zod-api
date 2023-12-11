import { Express } from "express";
import { createConfig } from "../../src";
import winston from "winston";
import { describe, expect, test, vi } from "vitest";

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
        logger: winston.createLogger({ silent: true }),
      };
      const config = createConfig(argument);
      expect(config).toEqual(argument);
    });
  });
});
