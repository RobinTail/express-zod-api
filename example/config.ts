import { createConfig } from "../src";

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
});
