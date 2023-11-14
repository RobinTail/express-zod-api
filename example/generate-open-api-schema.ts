import { writeFileSync } from "node:fs";
import { oas30 } from "openapi3-ts";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

writeFileSync(
  "example/example.swagger.yaml",
  new Documentation({
    oas: oas30,
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
