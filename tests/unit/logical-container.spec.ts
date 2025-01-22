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
  });
});
