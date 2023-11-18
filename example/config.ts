import express from "express";
import compression from "compression";
import fileUpload from "express-fileupload";
import { createConfig, createLogger } from "../src";
import winston from "winston";

export const config = createConfig({
  server: {
    listen: 8090,
    uploader: fileUpload({ abortOnLimit: false, parseNested: true }),
    compressor: compression(), // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
  },
  cors: true,
  logger: createLogger({ winston, level: "debug", color: true }),
  tags: {
    users: "Everything about the users",
    files: "Everything about the files processing",
  },
});
