import { createConfig } from "../src";
import ui from "swagger-ui-express";
import yaml from "yaml";
import { readFile } from "node:fs/promises";
import createHttpError from "http-errors";

export const config = createConfig({
  http: { listen: 8090 },
  upload: {
    limits: { fileSize: 51200 },
    limitError: createHttpError(413, "The file is too large"), // affects uploadAvatarEndpoint
  },
  inputSources: {
    patch: ["body", "headers", "params"], // affects updateUserEndpoint using authMiddleware
  },
  compression: true, // affects sendAvatarEndpoint
  beforeRouting: async ({ app }) => {
    // third-party middlewares serving their own routes or establishing their own routing besides the API
    const documentation = yaml.parse(
      await readFile("example/example.documentation.yaml", "utf-8"),
    );
    app.use("/docs", ui.serve, ui.setup(documentation));
  },
  cors: true,
  tags: {
    users: "Everything about the users",
    files: "Everything about the files processing",
    subscriptions: "Everything about the subscriptions",
  },
});

// Uncomment these lines when using a custom logger, for example winston:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/

// Uncomment these lines for using .child() and .profile() methods of built-in logger:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}
*/
