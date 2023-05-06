import express from "express";
import { attachRouting, createConfig } from "../dist";

const app = express();

const config = createConfig({
  app,
  cors: true,
  startupLogo: false,
  logger: { level: "debug", color: true },
});
const routing = {};
const { logger } = attachRouting(config, routing);

const server = app.listen(6060, () => {
  logger.info("started without logo");
  server.close(() => {
    process.exit(0);
  });
});
