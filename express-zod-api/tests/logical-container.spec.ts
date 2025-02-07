import { processContainers } from "../src/logical-container";

describe("LogicalContainer", () => {
  describe("processContainers()", () => {
    test("should process simples", () => {
      expect(processContainers([1])).toEqual([[1]]);
      expect(processContainers([1, 2, 3])).toEqual([[1, 2, 3]]);
    });

    test("should take simples out of ANDs", () => {
      expect(processContainers([{ and: [1, 2] }])).toEqual([[1, 2]]);
      expect(processContainers([{ and: [1, 2] }, { and: [3, 4] }])).toEqual([
        [1, 2, 3, 4],
      ]);
      expect(processContainers([{ and: [] }, 1])).toEqual([[1]]);
      expect(processContainers([{ and: [1] }, 2])).toEqual([[2, 1]]);
      expect(processContainers([{ and: [1, 2] }, 3])).toEqual([[3, 1, 2]]);
    });

    test("should take ORs from ANDs", () => {
      expect(processContainers([{ and: [{ or: [1, 2] }] }])).toEqual([
        [1],
        [2],
      ]);
      expect(
        processContainers([{ and: [{ or: [1, 2] }, { or: [3, 4] }] }]),
      ).toEqual([
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
      ]);
      expect(
        processContainers([
          { and: [{ or: [1, 2] }, { or: [3, 4] }] },
          { and: [{ or: [5, 6] }, { or: [7, 8] }] },
        ]),
      ).toEqual([
        [1, 3, 5, 7],
        [1, 3, 5, 8],
        [1, 3, 6, 7],
        [1, 3, 6, 8],
        [1, 4, 5, 7],
        [1, 4, 5, 8],
        [1, 4, 6, 7],
        [1, 4, 6, 8],
        [2, 3, 5, 7],
        [2, 3, 5, 8],
        [2, 3, 6, 7],
        [2, 3, 6, 8],
        [2, 4, 5, 7],
        [2, 4, 5, 8],
        [2, 4, 6, 7],
        [2, 4, 6, 8],
      ]);
    });

    test("should take simples out of ORs", () => {
      expect(processContainers([{ or: [1, 2] }])).toEqual([[1], [2]]);
      expect(processContainers([{ or: [1, 2] }, { or: [3, 4] }])).toEqual([
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
      ]);
      expect(processContainers([{ or: [1, 2] }, { or: [] }])).toEqual([
        [1],
        [2],
      ]);
      expect(processContainers([{ or: [] }, 1])).toEqual([[1]]);
      expect(processContainers([{ or: [1] }, 2])).toEqual([[2, 1]]);
    });

    test("should take ANDs from ORs", () => {
      expect(processContainers([{ or: [{ and: [1, 2] }] }])).toEqual([[1, 2]]);
      expect(processContainers([{ or: [{ and: [1, 2] }] }, 3])).toEqual([
        [3, 1, 2],
      ]);
      expect(
        processContainers([{ or: [{ and: [1, 2] }, { and: [3, 4] }] }]),
      ).toEqual([
        [1, 2],
        [3, 4],
      ]);
      expect(
        processContainers([
          { or: [{ and: [1, 2] }, { and: [3, 4] }] },
          { or: [{ and: [5, 6] }, { and: [7, 8] }] },
        ]),
      ).toEqual([
        [1, 2, 5, 6],
        [1, 2, 7, 8],
        [3, 4, 5, 6],
        [3, 4, 7, 8],
      ]);
    });

    test("legacy tests and combinations", () => {
      expect(processContainers([{ and: [1, 2, { or: [3, 4] }] }, 5])).toEqual([
        [5, 1, 2, 3],
        [5, 1, 2, 4],
      ]);
      expect(processContainers([{ or: [1, 2, { and: [3, 4] }] }, 5])).toEqual([
        [5, 1],
        [5, 2],
        [5, 3, 4],
      ]);
      expect(processContainers([{ and: [1, 2] }, { or: [3, 4] }])).toEqual([
        [1, 2, 3],
        [1, 2, 4],
      ]);
      expect(processContainers([{ or: [1, 2] }, { and: [3, 4] }])).toEqual([
        [3, 4, 1],
        [3, 4, 2],
      ]);
    });

    test("Issue #816: combining empty LogicalAnd with a flat that is an object", () => {
      expect(
        processContainers([{ and: [] }, { type: "bearer", format: "JWT" }]),
      ).toEqual([[{ type: "bearer", format: "JWT" }]]);
      expect(
        processContainers([{ type: "bearer", format: "JWT" }, { and: [] }]),
      ).toEqual([[{ type: "bearer", format: "JWT" }]]);
    });
  });
});
