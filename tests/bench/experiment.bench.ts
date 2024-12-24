import { bench } from "vitest";
import { isProduction } from "../../src/common-helpers";

/**
 * @see https://x.com/colinhacks/status/1865002498332795032
 * @see https://x.com/colinhacks/status/1865143412812664985
 * @see https://gist.github.com/colinhacks/a8d5772c1078b9285efb2455ab95fadf
 */
function lazyWithGetterOverride<T>(getter: () => T): {
  value: T;
} {
  return {
    get value() {
      const value = getter();
      Object.defineProperty(this, "value", { value });
      return value;
    },
  };
}

const feat = lazyWithGetterOverride(
  () => process.env.NODE_ENV === "production",
);

describe("Experiment: memo vs. getter override", () => {
  bench("current", () => {
    isProduction();
  });

  bench("featured", () => {
    feat.value;
  });
});
