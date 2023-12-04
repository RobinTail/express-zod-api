import { writeFileSync } from "node:fs";
import { Documentation } from "express-zod-api";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../express-zod-api/package.json";

writeFileSync(
  "example.swagger.yaml",
  new Documentation({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
