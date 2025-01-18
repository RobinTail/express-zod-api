import { writeFile } from "node:fs/promises";
import { DependsOnMethod, Documentation } from "../src";
import { config } from "./config";
import { updateUserEndpoint } from "./endpoints/update-user";
import manifest from "../package.json";

await writeFile(
  "example/example.documentation.yaml",
  new Documentation({
    routing: {
      v1: {
        user: {
          // syntax 2: methods are defined within the route (id is the route path param by the way)
          ":id": new DependsOnMethod({
            patch: updateUserEndpoint, // demonstrates authentication
          }),
        },
      },
    },
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "https://example.com",
  }).getSpecAsYaml(),
  "utf-8",
);
