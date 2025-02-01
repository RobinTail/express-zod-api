import { F, tryCatch } from "ramda";
import { bench } from "vitest";

const fn1 = () => new Array(1000).fill(0);
const fn2 = () => {
  throw new Error("Expected");
};

describe("Experiment on try..catch with success", () => {
  bench("try..catch", () => {
    fn1();
  });

  bench("tryCatch()", () => {
    tryCatch(fn1, F)();
  });
});

describe("Experiment on try..catch with error", () => {
  bench("try..catch", () => {
    try {
      fn2();
    } catch {}
  });

  bench("tryCatch()", () => {
    tryCatch(fn2, F)();
  });
});
