import { writeFile } from "node:fs/promises";
import { createDocumentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

const documentation = await createDocumentation({
  routing,
  config,
  version: manifest.version,
  title: "Example API",
  serverUrl: "https://example.com",
});

await writeFile(
  "example/example.documentation.yaml",
  documentation.print(),
  "utf-8",
);
