import { mimeJson } from "../../src/mime";

jest.mock("mime", () => ({
  getType: jest.fn(() => null),
}));

describe("Mime", () => {
  describe("mimeJson", () => {
    test("Is valid even when mime module is not operational", () => {
      expect(mimeJson).toEqual("application/json");
    });
  });
});
