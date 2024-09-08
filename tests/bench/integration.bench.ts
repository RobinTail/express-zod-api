import { bench } from "vitest";
import { routing } from "../../example/routing";
import { Integration } from "../../src";

describe("Integration", () => {
  bench(
    "example",
    () => {
      const instance = new Integration({ routing });
      expect(instance).toBeInstanceOf(Integration);
    },
    { time: 15000 },
  );
});
