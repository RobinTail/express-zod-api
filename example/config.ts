import express from "express";
import winston from "winston";
import { createConfig, createLogger } from "../src";

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
    compression: true, // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
  },
  cors: true,
  logger: createLogger({ winston, level: "debug", color: true }),
  tags: {
    users: "Everything about the users",
    files: "Everything about the files processing",
  },
});
