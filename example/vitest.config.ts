import { defineConfig } from "vitest/config";
import { ThreadsPoolWorker } from "vitest/node";

export default defineConfig({
  test: {
    globals: true,
    pool: {
      name: "custom-threads-pool",
      createPoolWorker: (opt) =>
        new ThreadsPoolWorker({
          ...opt,
          /** @todo remove when unflagged https://nodejs.org/docs/v24.0.0/api/globals.html#eventsource */
          execArgv: ["--experimental-eventsource"],
        }),
    },
  },
});
