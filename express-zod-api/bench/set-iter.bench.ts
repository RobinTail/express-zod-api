import { bench } from "vitest";

describe("Set iteration", () => {
  const set = new Set([1, 2]);
  const mapper = (x: number) => x * 2;
  bench("spread map", () => {
    return void [...set].map(mapper);
  });
  bench("values map", () => {
    return void set.values().map(mapper);
  });
});
