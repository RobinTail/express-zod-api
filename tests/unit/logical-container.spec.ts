import {
  andToOr,
  combineContainers,
  mapLogicalContainer,
} from "../../src/logical-container";

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

  describe("combineContainers()", () => {
    test("should combine flats", () => {
      expect(combineContainers(1, 2)).toEqual({ and: [1, 2] });
    });
    test("should combine two LogicalAnd", () => {
      expect(combineContainers({ and: [1, 2] }, { and: [3, 4] })).toEqual({
        and: [1, 2, 3, 4],
      });
      expect(
        combineContainers(
          { and: [{ or: [1, 2] }, { or: [3, 4] }] },
          { and: [{ or: [5, 6] }, { or: [7, 8] }] }
        )
      ).toEqual({
        and: [{ or: [1, 2] }, { or: [3, 4] }, { or: [5, 6] }, { or: [7, 8] }],
      });
    });
    test("should combine two LogicalOr", () => {
      expect(combineContainers({ or: [1, 2] }, { or: [3, 4] })).toEqual({
        or: [
          { and: [1, 3] },
          { and: [1, 4] },
          { and: [2, 3] },
          { and: [2, 4] },
        ],
      });
    });
    test("should handle empty and non-empty LogicalOr", () => {
      expect(combineContainers({ or: [1, 2] }, { or: [] })).toEqual({
        or: [1, 2],
      });
    });
    test("should handle two complex LogicalOr", () => {
      expect(
        combineContainers(
          { or: [{ and: [1, 2] }, { and: [3, 4] }] },
          { or: [{ and: [5, 6] }, { and: [7, 8] }] }
        )
      ).toEqual({
        or: [
          { and: [1, 2, 5, 6] },
          { and: [1, 2, 7, 8] },
          { and: [3, 4, 5, 6] },
          { and: [3, 4, 7, 8] },
        ],
      });
    });
    test("should combine LogicalAnd with LogicalOr", () => {
      expect(combineContainers({ and: [1, 2] }, { or: [3, 4] })).toEqual({
        or: [{ and: [1, 2, 3] }, { and: [1, 2, 4] }],
      });
    });
    test("should handle reverse order", () => {
      expect(combineContainers({ or: [1, 2] }, { and: [3, 4] })).toEqual({
        or: [{ and: [3, 4, 1] }, { and: [3, 4, 2] }],
      });
    });
    test("should combine LogicalAnd and flat", () => {
      expect(combineContainers({ and: [] }, 1)).toEqual({ and: [1] });
    });
  });
});
