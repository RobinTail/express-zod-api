import fs from "node:fs";
import { OpenAPI } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

for (const variant of ["3.0", "3.1"] as const) {
  fs.writeFileSync(
    `example/example.documentation.${variant}.yaml`,
    new OpenAPI({
      variant,
      routing,
      config,
      version: manifest.version,
      title: "Example API",
      serverUrl: "http://example.com",
    }).getSpecAsYaml(),
    "utf8"
  );
}
