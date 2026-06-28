import { bench } from "vitest";

describe("Set iteration", () => {
  const set = new Set([1, 2]);
  const mapper = (x: number) => x * 2;
  bench("spread map", () => {
    [...set].map(mapper);
  });
  bench("values map", () => {
    set.values().map(mapper);
  });
});
