import { thunkify } from "ramda";
import { bench } from "vitest";
import { isProduction } from "../../src/common-helpers";

describe("Experiment on memo/thunk", () => {
  bench("current", () => {
    isProduction();
  });

  const feat = thunkify(() => process.env.NODE_ENV === "production")();

  bench("feat", () => {
    feat();
  });
});
