import { mapLogicalContainer } from "../../src/logical-container";

describe("LogicalContainer", () => {
  describe("mapLogicalContainer()", () => {
    test("should map LogicalAnd", () => {
      expect(
        mapLogicalContainer(
          { and: [1, 2, { or: [3, 4] }, 5] },
          (value) => value * 2
        )
      ).toEqual({ and: [2, 4, { or: [6, 8] }, 10] });
    });
    test("should map LogicalOr", () => {
      expect(
        mapLogicalContainer(
          { or: [1, 2, { and: [3, 4] }, 5] },
          (value) => value * 2
        )
      ).toEqual({ or: [2, 4, { and: [6, 8] }, 10] });
    });
    test("should accept plain value", () => {
      expect(mapLogicalContainer(1, (value) => value * 2)).toBe(2);
    });
  });
});
