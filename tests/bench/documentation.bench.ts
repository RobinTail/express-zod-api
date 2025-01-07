import { bench } from "vitest";
import { config } from "../../example/config.ts";
import { routing } from "../../example/routing.ts";
import { Documentation } from "../../src/index.ts";

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
