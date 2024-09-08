import { Documentation, createConfig } from "express-zod-api";
import { getProductPricesEndpoint } from "./endpoint.js";

const yaml = new Documentation({
  version: "1.0.0",
  title: "Discussion 2024",
  serverUrl: "https://example.com",
  config: createConfig({
    logger: { level: "debug" },
    server: { listen: 8090 },
    cors: true,
  }),
  routing: {
    api: { product: { unit: { prices: getProductPricesEndpoint } } },
  },
}).getSpecAsYaml();

console.log(yaml);
