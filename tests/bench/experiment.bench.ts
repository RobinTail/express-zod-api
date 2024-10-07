import { bench } from "vitest";
import { keys, keysIn } from "ramda";
import { defaultStatusCodes } from "../../src/api-response";

describe("Experiment %s", () => {
  bench("Object.keys()", () => {
    Object.keys(defaultStatusCodes);
  });

  bench("R.keys()", () => {
    keys(defaultStatusCodes);
  });

  bench("R.keysIn()", () => {
    keysIn(defaultStatusCodes);
  });
});
