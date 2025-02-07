import { bench } from "vitest";
import { routing } from "../../example/routing";
import { Integration } from "../../express-zod-api/src";

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
