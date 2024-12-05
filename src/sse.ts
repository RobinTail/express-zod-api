import { z } from "zod";
import { contentTypes } from "./content-type";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";
import { setTimeout } from "node:timers/promises";

export const sseResultHandler = new ResultHandler({
  positive: (data) => ({
    mimeType: contentTypes.sse,
    schema: z.object({
      data,
      event: z.string().optional(),
      id: z.string().optional(),
      retry: z.number().int().positive().optional(),
    }),
  }),
  negative: { schema: z.string() },
  handler: async ({ response, error, logger, request, input }) => {
    if (error) {
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      return void response
        .status(httpError.statusCode)
        .end(getPublicErrorMessage(httpError));
    }
    response
      .status(200)
      .type(contentTypes.sse)
      .setHeader("cache-control", "no-cache")
      .setHeader("connection", "keep-alive")
      .flushHeaders();

    while (!response.writableEnded && !response.closed) {
      await setTimeout(1000);
      logger.debug("emitting...");
      response.write(`event: time\ndata: ${Date.now()}\n\n`, "utf-8");
      response.flush();
    }
    response.end();
  },
});
