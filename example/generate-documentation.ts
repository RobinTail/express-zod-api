import fs from "node:fs";
import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

for (const variant of ["3.0", "3.1"] as const) {
  fs.writeFileSync(
    `example/example.documentation.${variant}.yaml`,
    new Documentation({
      variant,
      routing,
      config,
      version: manifest.version,
      title: "Example API",
      serverUrl: "http://example.com",
    }).builder.getSpecAsYaml(),
    "utf8"
  );
}
