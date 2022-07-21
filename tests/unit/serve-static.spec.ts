import { ServeStatic } from "../../src/index.js";

describe("ServeStatic", () => {
  describe("constructor()", () => {
    test("should create an instance that provides original params", () => {
      const serverStatic = new ServeStatic(process.cwd(), { dotfiles: "deny" });
      expect(serverStatic).toBeInstanceOf(ServeStatic);
      expect(serverStatic.params).toEqual([
        process.cwd(),
        { dotfiles: "deny" },
      ]);
    });
  });
});
