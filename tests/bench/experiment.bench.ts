import { bench } from "vitest";

describe("Experiment %s", () => {
  const map = new WeakMap();
  const set = new WeakSet();
  const obj = {};

  bench("WeakMap.has()", () => {
    map.has({});
  });

  bench("WeakSet.has()", () => {
    set.has({});
  });

  bench("control: in", () => void ("test" in obj));
  bench("control: hasOwn", () => void Object.hasOwn(obj, "test"));
});
