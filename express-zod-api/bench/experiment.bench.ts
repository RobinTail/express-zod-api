import { Console } from "node:console";
import { Writable } from "node:stream";
import { bench } from "vitest";

describe("Experiment for key lookup", () => {
  const console = new Console({ stdout: new Writable() });

  bench("sync", () => {
    console.log("test", [1, 2, 3]);
  });

  bench("async", () => {
    setImmediate(console.log, "test", [1, 2, 3]);
  });
});
