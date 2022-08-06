import { andToOr, mapLogicalContainer } from "../../src/logical-container";

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

  describe("andToOr()", () => {
    test("should convert LogicalAnd of plains", () => {
      expect(andToOr({ and: [1, 2, 3] })).toEqual({
        or: [{ and: [1, 2, 3] }],
      });
    });
    test("should handle LogicalOr inside", () => {
      expect(andToOr({ and: [1, { or: [2, 3] }, 4] })).toEqual({
        or: [{ and: [1, 2, 4] }, { and: [1, 3, 4] }],
      });
    });
    test("should handle multiple LogicalOr", () => {
      expect(andToOr({ and: [1, { or: [2, 3] }, { or: [4, 5] }, 6] })).toEqual({
        or: [
          { and: [1, 2, 4, 6] },
          { and: [1, 2, 5, 6] },
          { and: [1, 3, 4, 6] },
          { and: [1, 3, 5, 6] },
        ],
      });
    });
  });
});
