import { bench, describe, expect } from "vitest";
import { routing } from "../../example/routing";
import { Integration } from "../../src";

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
