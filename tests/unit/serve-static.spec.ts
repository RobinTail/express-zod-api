import { serveStatic } from "../../src";

describe("serveStatic()", () => {
  test("should return static handling function", () => {
    expect(typeof serveStatic(__dirname, { dotfiles: "deny" })).toBe(
      "function"
    );
  });
});
