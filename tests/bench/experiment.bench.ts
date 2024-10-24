import { bench } from "vitest";
import { jsonReplacer as current } from "../../src/server-helpers";

const sample = {
  a: {
    b: {
      c: {
        d: new Map(),
        e: new Set(),
        f: 10,
        g: 20,
        h: 30,
        i: 40,
      },
    },
  },
};

const control = (_key: PropertyKey, v: unknown) => v;

const featured = (_key: PropertyKey, value: unknown) => {
  if (value instanceof Map || value instanceof Set) {
    const result: unknown[] = [];
    for (const item of value) result.push(item);
    return result;
  }
  return value;
};

describe("Experiment", () => {
  bench("no replacer", () => {
    JSON.stringify(sample);
  });

  bench("empty replacer", () => {
    JSON.stringify(sample, control);
  });

  bench("current implementation", () => {
    JSON.stringify(sample, current);
  });

  bench("featured implementation", () => {
    JSON.stringify(sample, featured);
  });
});
