import { isValidDate } from "../../express-zod-api/src/schema-helpers";

describe("Schema helpers", () => {
  describe("isValidDate()", () => {
    test("should accept valid date", () => {
      expect(isValidDate(new Date())).toBeTruthy();
      expect(isValidDate(new Date("2021-01-31"))).toBeTruthy();
      expect(isValidDate(new Date("12.01.2022"))).toBeTruthy();
      expect(isValidDate(new Date("01/22/2022"))).toBeTruthy();
    });

    test("should handle invalid date", () => {
      expect(isValidDate(new Date("2021-01-32"))).toBeFalsy();
      expect(isValidDate(new Date("22/01/2022"))).toBeFalsy();
      expect(isValidDate(new Date("2021-01-31T25:00:00.000Z"))).toBeFalsy();
    });
  });
});
