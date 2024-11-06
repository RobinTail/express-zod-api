import { bench } from "vitest";
import { BuiltinLogger } from "../../src";

describe("Experiment for builtin logger", () => {
  const fixed = (a: string, b?: number) => `${a}${b}`;
  const generic = (...args: unknown[]) => args.join();
  const logger = new BuiltinLogger();

  bench("fixed 2", () => {
    return void fixed("second", 2);
  });

  bench("fixed 1", () => {
    return void fixed("second");
  });

  bench("generic 2", () => {
    return void generic("second", 2);
  });

  bench("generic 1", () => {
    return void generic("second");
  });

  bench(".child", () => {
    return void logger.child({});
  });
});
