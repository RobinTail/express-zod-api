import { bench } from "vitest";

describe("Experiment on mapping", () => {
  const src = new Set([1, 2, 3, 4, 5]);
  const mapper = (x: number) => x * 2;

  bench("Array.from().map()", () => {
    Array.from(src).map(mapper);
  });

  bench("Array.from(map)", () => {
    Array.from(src, mapper);
  });
});
