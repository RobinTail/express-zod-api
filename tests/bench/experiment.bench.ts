import { bench, describe } from "vitest";
import { formatDuration } from "../../src/logger-helpers";

describe.each([0.555, 555, 55555555])("Experiment", (ms) => {
  bench("original", () => {
    formatDuration(ms);
  });

  bench("featured", () => {});
});
