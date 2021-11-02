import { OpenAPI } from "../src";
import { routing } from "./routing";
import { version } from "../package.json";

console.log(
  new OpenAPI({
    routing,
    version,
    title: "Example API",
    serverUrl: "http://example.com",
  }).getSpecAsYaml()
);
