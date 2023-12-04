import { Documentation } from "express-zod-api";
import { config as exampleConfig } from "./config";
import { routing } from "./routing";

describe("System test for Documentation", () => {
  test.each([
    { composition: "inline" },
    { composition: "components" },
  ] as const)(
    "should generate the correct schema of example routing %#",
    ({ composition }) => {
      const spec = new Documentation({
        routing,
        config: exampleConfig,
        version: "1.2.3",
        title: "Example API",
        serverUrl: "https://example.com",
        composition,
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    },
  );
});
