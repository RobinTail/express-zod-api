import assert from "node:assert/strict";
import { bench } from "vitest";
import { RoutingError } from "../../src";
import { lazyAss } from "../../src/errors";

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

  bench("lazyAss Error", () => {
    try {
      lazyAss(ass, () => new Error());
    } catch {}
  });

  bench("lazyAss custom", () => {
    try {
      lazyAss(ass, () => new RoutingError());
    } catch {}
  });
});
