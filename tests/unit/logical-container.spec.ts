import {
  LogicalContainer,
  andToOr,
  combineContainers,
  mapLogicalContainer,
} from "../../src/logical-container";
import { describe, expect, test } from "vitest";

describe("LogicalContainer", () => {
  describe("mapLogicalContainer()", () => {
    test("should map LogicalAnd", () => {
      expect(
        mapLogicalContainer(
          { and: [1, 2, { or: [3, 4] }, 5] },
          (value) => value * 2,
        ),
      ).toEqual<LogicalContainer<number>>({ and: [2, 4, { or: [6, 8] }, 10] });
    });
    test("should map LogicalOr", () => {
      expect(
        mapLogicalContainer(
          { or: [1, 2, { and: [3, 4] }, 5] },
          (value) => value * 2,
        ),
      ).toEqual<LogicalContainer<number>>({ or: [2, 4, { and: [6, 8] }, 10] });
    });
    test("should accept plain value", () => {
      expect(mapLogicalContainer(1, (value) => value * 2)).toBe(2);
    });
  });

  describe("andToOr()", () => {
    test("should convert LogicalAnd of plains", () => {
      expect(andToOr({ and: [1, 2, 3] })).toEqual<LogicalContainer<number>>({
        or: [{ and: [1, 2, 3] }],
      });
    });
    test("should handle LogicalOr inside", () => {
      expect(andToOr({ and: [1, { or: [2, 3] }, 4] })).toEqual<
        LogicalContainer<number>
      >({
        or: [{ and: [1, 2, 4] }, { and: [1, 3, 4] }],
      });
    });
    test("should handle multiple LogicalOr", () => {
      expect(andToOr({ and: [1, { or: [2, 3] }, { or: [4, 5] }, 6] })).toEqual<
        LogicalContainer<number>
      >({
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
      expect(combineContainers(1, 2)).toEqual<LogicalContainer<number>>({
        and: [1, 2],
      });
    });
    test("should combine two LogicalAnd", () => {
      expect(combineContainers({ and: [1, 2] }, { and: [3, 4] })).toEqual<
        LogicalContainer<number>
      >({
        and: [1, 2, 3, 4],
      });
      expect(
        combineContainers(
          { and: [{ or: [1, 2] }, { or: [3, 4] }] },
          { and: [{ or: [5, 6] }, { or: [7, 8] }] },
        ),
      ).toEqual<LogicalContainer<number>>({
        and: [{ or: [1, 2] }, { or: [3, 4] }, { or: [5, 6] }, { or: [7, 8] }],
      });
    });
    test("should combine two LogicalOr", () => {
      expect(combineContainers({ or: [1, 2] }, { or: [3, 4] })).toEqual<
        LogicalContainer<number>
      >({
        or: [
          { and: [1, 3] },
          { and: [1, 4] },
          { and: [2, 3] },
          { and: [2, 4] },
        ],
      });
    });
    test("should handle empty and non-empty LogicalOr", () => {
      expect(combineContainers({ or: [1, 2] }, { or: [] })).toEqual<
        LogicalContainer<number>
      >({
        or: [1, 2],
      });
    });
    test("should handle two complex LogicalOr", () => {
      expect(
        combineContainers(
          { or: [{ and: [1, 2] }, { and: [3, 4] }] },
          { or: [{ and: [5, 6] }, { and: [7, 8] }] },
        ),
      ).toEqual<LogicalContainer<number>>({
        or: [
          { and: [1, 2, 5, 6] },
          { and: [1, 2, 7, 8] },
          { and: [3, 4, 5, 6] },
          { and: [3, 4, 7, 8] },
        ],
      });
    });
    test("should combine LogicalAnd with LogicalOr", () => {
      expect(combineContainers({ and: [1, 2] }, { or: [3, 4] })).toEqual<
        LogicalContainer<number>
      >({ or: [{ and: [1, 2, 3] }, { and: [1, 2, 4] }] });
    });
    test("should handle reverse order", () => {
      expect(combineContainers({ or: [1, 2] }, { and: [3, 4] })).toEqual<
        LogicalContainer<number>
      >({ or: [{ and: [3, 4, 1] }, { and: [3, 4, 2] }] });
    });
    test("should combine LogicalAnd and flat", () => {
      expect(combineContainers({ and: [] }, 1)).toEqual<
        LogicalContainer<number>
      >({ and: [1] });
      expect(combineContainers(1, { and: [] })).toEqual<
        LogicalContainer<number>
      >({ and: [1] });
      expect(combineContainers({ and: [1] }, 2)).toEqual<
        LogicalContainer<number>
      >({ and: [1, 2] });
      expect(combineContainers(1, { and: [2] })).toEqual<
        LogicalContainer<number>
      >({ and: [2, 1] });
      expect(combineContainers({ and: [1, 2] }, 3)).toEqual<
        LogicalContainer<number>
      >({ and: [1, 2, 3] });
    });
    test("should combine LogicalOr and flat", () => {
      expect(combineContainers({ or: [] }, 1)).toEqual<
        LogicalContainer<number>
      >({ or: [1] });
      expect(combineContainers(1, { or: [] })).toEqual<
        LogicalContainer<number>
      >({ or: [1] });
      expect(combineContainers({ or: [1] }, 2)).toEqual<
        LogicalContainer<number>
      >({ or: [{ and: [2, 1] }] });
      expect(combineContainers(1, { or: [2] })).toEqual<
        LogicalContainer<number>
      >({ or: [{ and: [1, 2] }] });
      expect(combineContainers({ or: [{ and: [1, 2] }] }, 3)).toEqual<
        LogicalContainer<number>
      >({ or: [{ and: [3, 1, 2] }] });
    });

    test("Issue #816: combining empty LogicalAnd with a flat that is an object", () => {
      expect(
        combineContainers({ and: [] }, { type: "bearer", format: "JWT" }),
      ).toEqual({ and: [{ type: "bearer", format: "JWT" }] });
      expect(
        combineContainers({ type: "bearer", format: "JWT" }, { and: [] }),
      ).toEqual({ and: [{ type: "bearer", format: "JWT" }] });
    });
  });
});
