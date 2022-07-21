import { OpenAPI } from "../src/index.js";
import { config } from "./config.js";
import { routing } from "./routing.js";
import manifest from "../package.json";

console.log(
  new OpenAPI({
    routing,
    config,
    version: manifest.version,
    title: "Example API",
    serverUrl: "http://example.com",
  }).getSpecAsYaml()
);
