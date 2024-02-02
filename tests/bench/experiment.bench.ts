import { bench, describe } from "vitest";

describe.skip("Experiment", () => {
  const originalFn = () => {};

  bench(
    "original",
    () => {
      originalFn();
    },
    { time: 5000 },
  );

  bench("featured", () => {}, { time: 5000 });
});
