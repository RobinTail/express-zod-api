import { writeFile } from "node:fs/promises";
import { createDocumentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

const common = {
  routing,
  config,
  version: manifest.version,
  title: "Example API",
  serverUrl: "https://example.com",
};

const openApi30 = await createDocumentation({
  oas: "3.0",
  ...common,
});

await writeFile(
  "example/example.documentation-3.0.yaml",
  openApi30.print(),
  "utf-8",
);

const documentation = await createDocumentation({
  oas: "3.1",
  ...common,
});

await writeFile(
  "example/example.documentation-3.1.yaml",
  documentation.print(),
  "utf-8",
);
