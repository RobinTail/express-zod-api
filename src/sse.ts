import { z } from "zod";
import { contentTypes } from "./content-type";
import { Middleware } from "./middleware";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";

type EventsMap = Record<string, z.ZodTypeAny>;

export const createEventStreamMiddleware = <E extends EventsMap>(events: E) =>
  new Middleware({
    handler: async ({ response }) => {
      response
        .type(contentTypes.sse)
        .setHeader("cache-control", "no-cache")
        .setHeader("connection", "keep-alive")
        .flushHeaders();
      return {
        isClosed: () => response.writableEnded || response.closed,
        emit: <K extends keyof E>(event: K, data: z.input<E[K]>) => {
          response.write(
            `event: ${String(event)}\ndata: ${JSON.stringify(events[event].parse(data))}\n\n`,
            "utf-8",
          );
          response.flush();
        },
      };
    },
  });

const eventSchema = z.object({
  event: z.string(), // @todo should be particular ones
  data: z.any(), // @todo find better way
  id: z.string().optional(),
  retry: z.number().int().positive().optional(),
});

export const sseResultHandler = new ResultHandler({
  positive: { mimeType: contentTypes.sse, schema: eventSchema },
  negative: { mimeType: contentTypes.sse, schema: eventSchema },
  handler: async ({ response, error, logger, request, input }) => {
    if (error) {
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      return void response
        .status(httpError.statusCode)
        .end(getPublicErrorMessage(httpError));
    }
    response.status(200).end();
  },
});
