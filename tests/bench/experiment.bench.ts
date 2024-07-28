import { bench, describe } from "vitest";
import { getCustomHeaders } from "../../src/common-helpers";

describe("Experiment", () => {
  bench("original", () => {
    getCustomHeaders({
      authorization: "Bearer ***",
      "x-request-id": "test",
      "x-another": "header",
    });
  });

  bench("featured", () => {
    getCustomHeaders({
      authorization: "Bearer ***",
      "x-request-id": "test",
      "x-another": "header",
    });
  });
});
