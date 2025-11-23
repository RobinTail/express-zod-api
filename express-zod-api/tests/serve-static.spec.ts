import { staticMock, staticHandler } from "./express-mock";
import { ServeStatic } from "../src";

describe("ServeStatic", () => {
  describe("constructor()", () => {
    test("should create an instance that provides original params", () => {
      const serverStatic = new ServeStatic(__dirname, { dotfiles: "deny" });
      expect(serverStatic).toBeInstanceOf(ServeStatic);
      const handlerMock = vi.fn();
      serverStatic.apply("/some/path", handlerMock);
      expect(staticMock).toHaveBeenCalledWith(__dirname, { dotfiles: "deny" });
      expect(handlerMock).toHaveBeenCalledWith("/some/path", staticHandler);
    });
  });
});
