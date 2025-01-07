import { writeFile } from "node:fs/promises";
import { Documentation } from "../src/index.ts";
import { config } from "./config.ts";
import { routing } from "./routing.ts";
import manifest from "../package.json";

await writeFile(
  "example/example.documentation.yaml",
  new Documentation({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
