import { processContainers } from "../../src/logical-container";

describe("LogicalContainer", () => {
  describe("processContainers()", () => {
    const mult2 = (value: number) => value * 2;

    test("should process simples", () => {
      expect(processContainers([1], mult2)).toEqual([[2]]);
      expect(processContainers([1, 2, 3], mult2)).toEqual([[2, 4, 6]]);
    });

    test("should take simples out of ANDs", () => {
      expect(processContainers([{ and: [1, 2] }], mult2)).toEqual([[2, 4]]);
      expect(
        processContainers([{ and: [1, 2] }, { and: [3, 4] }], mult2),
      ).toEqual([[2, 4, 6, 8]]);
    });

    test("should take ORs from ANDs", () => {
      expect(processContainers([{ and: [{ or: [1, 2] }] }], mult2)).toEqual([
        [2],
        [4],
      ]);
      expect(
        processContainers([{ and: [{ or: [1, 2] }, { or: [3, 4] }] }], mult2),
      ).toEqual([
        [2, 6],
        [2, 8],
        [4, 6],
        [4, 8],
      ]);
      expect(
        processContainers(
          [
            { and: [{ or: [1, 2] }, { or: [3, 4] }] },
            { and: [{ or: [5, 6] }, { or: [7, 8] }] },
          ],
          mult2,
        ),
      ).toEqual([
        [2, 6, 10, 14],
        [2, 6, 10, 16],
        [2, 6, 12, 14],
        [2, 6, 12, 16],
        [2, 8, 10, 14],
        [2, 8, 10, 16],
        [2, 8, 12, 14],
        [2, 8, 12, 16],
        [4, 6, 10, 14],
        [4, 6, 10, 16],
        [4, 6, 12, 14],
        [4, 6, 12, 16],
        [4, 8, 10, 14],
        [4, 8, 10, 16],
        [4, 8, 12, 14],
        [4, 8, 12, 16],
      ]);
    });

    test("should take simples out of ORs", () => {
      expect(processContainers([{ or: [1, 2] }], mult2)).toEqual([[2], [4]]);
      expect(
        processContainers([{ or: [1, 2] }, { or: [3, 4] }], mult2),
      ).toEqual([
        [2, 6],
        [2, 8],
        [4, 6],
        [4, 8],
      ]);
    });

    test("should take ANDs from ORs", () => {
      expect(processContainers([{ or: [{ and: [1, 2] }] }], mult2)).toEqual([
        [2, 4],
      ]);
      expect(
        processContainers([{ or: [{ and: [1, 2] }, { and: [3, 4] }] }], mult2),
      ).toEqual([
        [2, 4],
        [6, 8],
      ]);
    });

    test("legacy tests", () => {
      expect(
        processContainers([{ and: [1, 2, { or: [3, 4] }] }, 5], mult2),
      ).toEqual([
        [10, 2, 4, 6],
        [10, 2, 4, 8],
      ]);
      expect(
        processContainers([{ or: [1, 2, { and: [3, 4] }] }, 5], mult2),
      ).toEqual([
        [10, 2],
        [10, 4],
        [10, 6, 8],
      ]);
    });
  });
});
