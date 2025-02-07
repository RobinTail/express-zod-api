import { bench } from "vitest";
import { config } from "../../example/config";
import { routing } from "../../example/routing";
import { Documentation } from "../../express-zod-api/src";

describe.skip("Documentation", () => {
  bench(
    "example",
    () => {
      const spec = new Documentation({
        routing,
        config,
        version: "1.0.0",
        title: "Example API",
        serverUrl: "https://example.com",
      });
      expect(spec.rootDoc.info.version).toBe("1.0.0");
    },
    { time: 15000 },
  );
});
