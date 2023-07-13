import { Documentation } from "../src";
import { config } from "./config";
import { routing } from "./routing";
import manifest from "../package.json";

console.log(
  new Documentation({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "http://example.com",
  }).getSpecAsYaml(),
);
