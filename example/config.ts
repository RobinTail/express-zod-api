import { BuiltinLogger, createConfig } from "express-zod-api";
import ui from "swagger-ui-express";
import createHttpError from "http-errors";

export const config = createConfig({
  http: { listen: 8090 },
  upload: {
    limits: { fileSize: 51200 },
    limitError: createHttpError(413, "The file is too large"), // affects uploadAvatarEndpoint
  },
  compression: true, // affects sendAvatarEndpoint
  // third-party middlewares serving their own routes or establishing their own routing besides the API
  beforeRouting: ({ app }) => {
    app.use(
      "/docs",
      ui.serve,
      ui.setup(null, { swaggerUrl: "/public/docs.yaml" }),
    );
  },
  inputSources: {
    patch: ["headers", "body", "params"], // affects authMiddleware used by updateUserEndpoint
  },
  cors: true,
});

// These lines enable .child() and .profile() methods of built-in logger:
declare module "express-zod-api" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation
  interface LoggerOverrides extends BuiltinLogger {}
}

// Uncomment these lines when using a custom logger, for example winston:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/

// These lines enable constraints on tags
declare module "express-zod-api" {
  interface TagOverrides {
    users: unknown;
    files: unknown;
    subscriptions: unknown;
  }
}
