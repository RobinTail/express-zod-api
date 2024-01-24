import { bench, describe } from "vitest";
import { FlatObject } from "../../src";
import { getCustomHeaders, isCustomHeader } from "../../src/common-helpers";

describe("Experiment", () => {
  const originalFn = (request: Request) =>
    Object.entries(request.headers).reduce<FlatObject>(
      (agg, [key, value]) =>
        isCustomHeader(key) ? { ...agg, [key]: value } : agg,
      {},
    );

  bench(
    "original",
    () => {
      originalFn({
        headers: {
          authorization: "Bearer ***",
          "x-request-id": "test",
          "x-another": "header",
        },
      } as unknown as Request);
    },
    { time: 1000 },
  );

  bench(
    "featured",
    () => {
      getCustomHeaders({
        authorization: "Bearer ***",
        "x-request-id": "test",
        "x-another": "header",
      });
    },
    { time: 1000 },
  );
});
