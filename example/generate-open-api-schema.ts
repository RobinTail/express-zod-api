import { writeFileSync } from "node:fs";
import { OpenApiBuilder } from "openapi3-ts/oas30";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

writeFileSync(
  "example/example.swagger.yaml",
  new Documentation({
    OpenApiBuilder,
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
