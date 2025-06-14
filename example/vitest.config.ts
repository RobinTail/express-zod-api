import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    pool: "threads",
    poolOptions: {
      threads: {
        /** @todo remove when unflagged https://nodejs.org/docs/v24.0.0/api/globals.html#eventsource */
        execArgv: ["--experimental-eventsource"],
      },
    },
  },
});
