import { ServeStatic } from "../../src";
import { describe, expect, test } from "vitest";

describe("ServeStatic", () => {
  describe("constructor()", () => {
    test("should create an instance that provides original params", () => {
      const serverStatic = new ServeStatic(__dirname, { dotfiles: "deny" });
      expect(serverStatic).toBeInstanceOf(ServeStatic);
      expect(serverStatic.params).toEqual([__dirname, { dotfiles: "deny" }]);
    });
  });
});
