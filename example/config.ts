import express from "express";
import { createConfig } from "../src";

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
    compression: true, // affects sendAvatarEndpoint
    rawParser: express.raw(), // required for rawAcceptingEndpoint
  },
  cors: true,
  logger: { level: "debug", color: true },
  tags: {
    users: "Everything about the users",
    files: "Everything about the files processing",
  },
});
