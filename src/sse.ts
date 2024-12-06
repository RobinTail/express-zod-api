import { z } from "zod";
import { EmptyObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { Handler } from "./endpoint";
import { EndpointsFactory } from "./endpoints-factory";
import { Middleware } from "./middleware";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";

type EventsMap = Record<string, z.ZodTypeAny>;

interface Emitter<E extends EventsMap> {
  isClosed: () => boolean;
  emit: <K extends keyof E>(event: K, data: z.input<E[K]>) => void;
}

const makeMiddleware = <E extends EventsMap>(events: E) =>
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

const makeEventSchema = (event: string, data: z.ZodTypeAny) =>
  z.object({
    data,
    event: z.literal(event),
    id: z.string().optional(),
    retry: z.number().int().positive().optional(),
  });

const makeResultHandler = <E extends EventsMap>(events: E) =>
  new ResultHandler({
    positive: {
      mimeType: contentTypes.sse,
      schema: Object.entries(events)
        .map(
          ([event, schema]) => makeEventSchema(event, schema) as z.ZodTypeAny,
        )
        .reduce((agg, schema) => agg.or(schema)),
    },
    negative: {
      mimeType: contentTypes.sse,
      schema: makeEventSchema("error", z.string()),
    },
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

export const unstable_createEventStream = <E extends EventsMap>({
  events,
  handler,
}: {
  events: E;
  handler: Handler<EmptyObject, void, Emitter<E>>;
}) =>
  new EndpointsFactory(makeResultHandler(events))
    .addMiddleware(makeMiddleware(events))
    .build({
      output: z.object({}),
      handler: async (params) => {
        await handler(params);
        return {};
      },
    });
