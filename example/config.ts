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
      limits: { fileSize: 51200 },
      limitError: createHttpError(413, "The file is too large"), // affects uploadAvatarEndpoint
    },
    compression: true, // affects sendAvatarEndpoint
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

// Uncomment these lines when using a custom logger, for example winston:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/
