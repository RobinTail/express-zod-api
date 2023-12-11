import { writeFile } from "node:fs/promises";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";

const manifest = (await import("../package.json", { assert: { type: "json" } }))
  .default;

await writeFile(
  "example/example.swagger.yaml",
  new Documentation({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
