import { writeFile } from "node:fs/promises";
import { Documentation } from "express-zod-api";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../express-zod-api/package.json";

await writeFile(
  "example.documentation.yaml",
  new Documentation({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
    tags: {
      users: "Everything about the users",
      files: "Everything about the files processing",
      subscriptions: "Everything about the subscriptions",
    },
  }).getSpecAsYaml(),
  "utf-8",
);
