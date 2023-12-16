import { writeFile } from "node:fs/promises";
import { OpenApiBuilder } from "openapi3-ts/oas30";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

await writeFile(
  "example/example.documentation.yaml",
  new Documentation({
    builder: new OpenApiBuilder(),
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).print(),
  "utf-8",
);
