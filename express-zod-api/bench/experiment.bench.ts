import * as R from "ramda";
import { bench } from "vitest";

describe("Experiment on path trimming", () => {
  const current = R.pipe(
    R.trim,
    R.split("/"),
    R.reject(R.isEmpty),
    R.join("/"),
  );

  const featured = (str: string) =>
    str.trim().split("/").filter(Boolean).join("/");

  const sample = "   ///v1/one/two/three///   ";

  bench("current (ramda)", () => {
    return void current(sample);
  });

  bench("featured (native)", () => {
    return void featured(sample);
  });
});
