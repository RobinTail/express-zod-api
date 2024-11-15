import assert from "node:assert/strict";
import { bench } from "vitest";
import { RoutingError } from "../../src";

describe.each([false, true])("Experiment for errors %s", (ass) => {
  const notAss = !ass;

  bench("assert with text", () => {
    try {
      assert(ass, "text");
    } catch {}
  });

  bench("assert with Error", () => {
    try {
      assert(ass, new Error());
    } catch {}
  });

  bench("assert with custom error", () => {
    try {
      assert(ass, new RoutingError());
    } catch {}
  });

  bench("throwing Error", () => {
    try {
      if (notAss) throw new Error();
    } catch {}
  });

  bench("throwing custom error", () => {
    try {
      if (notAss) throw new RoutingError();
    } catch {}
  });
});
