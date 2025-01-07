import { bench } from "vitest";
import { routing } from "../../example/routing.ts";
import { Integration } from "../../src/index.ts";

describe.skip("Integration", () => {
  bench(
    "example",
    () => {
      const instance = new Integration({ routing });
      expect(instance).toBeInstanceOf(Integration);
    },
    { time: 15000 },
  );
});
