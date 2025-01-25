import { writeFile } from "node:fs/promises";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

await writeFile(
  "example/example.documentation.yaml",
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
    /** @todo feat: detect header from mw Security schema after merging #2332 */
    isHeader: (name) => name === "token" || null,
  }).getSpecAsYaml(),
  "utf-8",
);
