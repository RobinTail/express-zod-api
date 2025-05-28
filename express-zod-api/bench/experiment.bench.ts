import * as R from "ramda";
import { bench } from "vitest";

describe("Experiment for unique elements", () => {
  const current = ["one", "two"];

  bench("set", () => {
    return void [...new Set(current).add("null")];
  });

  bench("R.union", () => {
    return void R.union(current, ["null"]);
  });
});
