import { createConfig } from "../src/index.js";

export const config = createConfig({
  server: {
    listen: 8090,
    upload: true,
    compression: true, // affects sendAvatarEndpoint
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
});
