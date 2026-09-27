import { isTypeName } from "../src/typescript-api";

describe("TypeScript API helpers", () => {
  describe("isTypeName()", () => {
    test.each(["Booking", "booking", "_Private", "$dollar", "Type1"])(
      "should accept %s",
      (name) => {
        expect(isTypeName(name)).toBe(true);
      },
    );

    test.each(["", "1st", "my-type", "with space", "string", "type", "null"])(
      "should reject %s",
      (name) => {
        expect(isTypeName(name)).toBe(false);
      },
    );
  });
});
