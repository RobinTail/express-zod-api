import express from "express";
import { z } from "zod";
import { createConfig, ez } from "../src";
import { createEmission } from "../src/emission";

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
});

// Uncomment these lines to set the type of logger used:
/*
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}
*/

/**
 * @desc The declaration of the schemas for the outgoing socket.io events
 * @todo consider keeping this in config
 * */
export const emission = createEmission({
  time: { schema: z.tuple([ez.dateOut()]) },
});
