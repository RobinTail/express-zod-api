import express from "express";
import { z } from "zod";
import { createConfig, ez } from "../src";

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
    compression: true, // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
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
  sockets: {
    timeout: 2000,
    emission: {
      time: { schema: z.tuple([ez.dateOut()]) },
    },
  },
});

// Uncomment these lines to set the type of logger used:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/
