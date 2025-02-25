import * as R from "ramda";
import { bench } from "vitest";

describe("Experiment for key lookup", () => {
  const subject = {
    a: 1,
    b: 2,
    c: 3,
  };

  bench("in", () => {
    return void ("a" in subject && "b" in subject && "c" in subject);
  });

  bench("R.has", () => {
    return void (
      R.has("a", subject) &&
      R.has("b", subject) &&
      R.has("c", subject)
    );
  });

  bench("Object.keys + includes", () => {
    const keys = Object.keys(subject);
    return void (
      keys.includes("a") &&
      keys.includes("b") &&
      keys.includes("c")
    );
  });
});
