import express from "express";
import { createConfig } from "../src";
import ui from "swagger-ui-express";
import yaml from "yaml";
import { readFileSync } from "node:fs";

const documentation = yaml.parse(
  readFileSync("example/example.documentation.yaml", "utf-8"),
);

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
    compression: true, // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
    beforeRouting: ({ app }) => {
      app.use("/docs", ui.serve, ui.setup(documentation));
    },
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
  tags: {
    users: "Everything about the users",
    files: "Everything about the files processing",
  },
});

// Uncomment these lines to set the type of logger used:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/
