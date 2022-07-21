import path from "node:path";
import { fileURLToPath } from "node:url";
import { ServeStatic } from "../../src/index.js";

describe("ServeStatic", () => {
  describe("constructor()", () => {
    test("should create an instance that provides original params", () => {
      const serverStatic = new ServeStatic(
        path.dirname(fileURLToPath(import.meta.url)),
        { dotfiles: "deny" }
      );
      expect(serverStatic).toBeInstanceOf(ServeStatic);
      expect(serverStatic.params).toEqual([
        path.dirname(fileURLToPath(import.meta.url)),
        { dotfiles: "deny" },
      ]);
    });
  });
});
