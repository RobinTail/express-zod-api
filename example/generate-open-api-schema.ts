import { OpenAPI } from "../src";
import { routing } from "./routing";
import manifest from "../package.json";

console.log(
  new OpenAPI({
    routing,
    version: manifest.version,
    title: "Example API",
    serverUrl: "http://example.com",
  }).getSpecAsYaml()
);
