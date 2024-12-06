import { Response } from "express";
import { z } from "zod";
import { EmptySchema, FlatObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { Handler } from "./endpoint";
import { EndpointsFactory } from "./endpoints-factory";
import { IOSchema } from "./io-schema";
import { Middleware } from "./middleware";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";

type EventsMap = Record<string, z.ZodTypeAny>;

interface Emitter<E extends EventsMap> extends FlatObject {
  isClosed: () => boolean;
  emit: <K extends keyof E>(event: K, data: z.input<E[K]>) => void;
}

const makeEventSchema = (event: string, data: z.ZodTypeAny) =>
  z.object({
    data,
    event: z.literal(event),
    id: z.string().optional(),
    retry: z.number().int().positive().optional(),
  });

const formatEvent = <E extends EventsMap>(
  events: E,
  event: keyof E,
  data: unknown,
) =>
  makeEventSchema(String(event), events[event])
    .transform((props) =>
      [
        `event: ${props.event}`,
        `data: ${JSON.stringify(props.data)}`,
        "",
        "", // empty line: events separator
      ].join("\n"),
    )
    .parse({ event, data });

const headersTimeout = 1e4; // 10s to respond with a status code other than 200
const ensureStream = (response: Response) =>
  response.headersSent ||
  response
    .type(contentTypes.sse)
    .setHeader("cache-control", "no-cache")
    .setHeader("connection", "keep-alive")
    .flushHeaders();

const makeMiddleware = <E extends EventsMap>(events: E) =>
  new Middleware({
    handler: async ({ response }): Promise<Emitter<E>> =>
      setTimeout(() => ensureStream(response), headersTimeout) && {
        isClosed: () => response.writableEnded || response.closed,
        emit: (event, data) => {
          ensureStream(response);
          response.write(formatEvent(events, event, data), "utf-8");
          response.flush();
        },
      },
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
    negative: { mimeType: "text/plain", schema: z.string() },
    handler: async ({ response, error, logger, request, input }) => {
      if (!error) return void response.end();
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      response
        .status(httpError.statusCode)
        .type("text/plain")
        .end(getPublicErrorMessage(httpError));
    },
  });

export const unstable_createEventStream = <
  E extends EventsMap,
  IN extends IOSchema = EmptySchema,
>({
  events,
  input,
  handler,
}: {
  events: E;
  input?: IN;
  handler: Handler<z.output<IN>, void, Emitter<E>>;
}) =>
  new EndpointsFactory(makeResultHandler(events))
    .addMiddleware(makeMiddleware(events))
    .build({
      input,
      output: z.object({}),
      handler: async (params) => {
        await handler(params);
        return {};
      },
    });
