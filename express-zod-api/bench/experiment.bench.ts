import { bench } from "vitest";

describe("Experiment for key lookup", () => {
  bench("sync", () => {
    console.log("test", [1, 2, 3]);
  });

  bench("async", () => {
    setImmediate(console.log, "test", [1, 2, 3]);
  });
});
