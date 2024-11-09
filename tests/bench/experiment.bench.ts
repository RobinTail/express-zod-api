import { bench } from "vitest";

const objects = [{ a: 1 }, { b: 2 }, { c: 3, a: 2 }];

describe("Experiment for reducer", () => {
  bench("current", () => {
    objects.reduce((agg, obj) => ({ ...agg, ...obj }), {});
  });

  bench("featured", () => {
    objects.reduce((agg, obj) => Object.assign(agg, obj), {});
  });
});
