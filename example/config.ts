import express from "express";
import { createConfig } from "../src";
import ui from "swagger-ui-express";
import yaml from "yaml";
import { readFileSync } from "node:fs";
import createHttpError from "http-errors";

const documentation = yaml.parse(
  readFileSync("example/example.documentation.yaml", "utf-8"),
);

export const config = createConfig({
  server: {
    listen: 8090,
    upload: {
      debug: true,
      limits: { fileSize: 51200 },
      limitError: createHttpError(413, "The file is too large"), // affects uploadAvatarEndpoint
    },
    compression: true, // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
    beforeRouting: ({ app }) => {
      // third-party middlewares serving their own routes or establishing their own routing besides the API
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
