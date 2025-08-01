import { Response } from "express";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { EndpointsFactory } from "./endpoints-factory";
import { Middleware } from "./middleware";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";

type EventsMap = Record<string, z.ZodType>;

export interface Emitter<E extends EventsMap> extends FlatObject {
  /** @desc Returns true when the connection was closed or terminated */
  isClosed: () => boolean;
  /** @desc Sends an event to the stream according to the declared schema */
  emit: <K extends keyof E>(event: K, data: z.input<E[K]>) => void;
}

export const makeEventSchema = (event: string, data: z.ZodType) =>
  z.object({
    data,
    event: z.literal(event),
    id: z.string().optional(),
    retry: z.int().positive().optional(),
  });

export const formatEvent = <E extends EventsMap>(
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
export const ensureStream = (response: Response) =>
  response.headersSent ||
  response.writeHead(200, {
    connection: "keep-alive",
    "content-type": contentTypes.sse,
    "cache-control": "no-cache",
  });

export const makeMiddleware = <E extends EventsMap>(events: E) =>
  new Middleware({
    handler: async ({ response }): Promise<Emitter<E>> =>
      setTimeout(() => ensureStream(response), headersTimeout) && {
        isClosed: () => response.writableEnded || response.closed,
        emit: (event, data) => {
          ensureStream(response);
          response.write(formatEvent(events, event, data), "utf-8");
          /**
           * Issue 2347: flush is the method of compression, it must be called only when compression is enabled
           * @link https://github.com/RobinTail/express-zod-api/issues/2347
           * */
          response.flush?.();
        },
      },
  });

export const makeResultHandler = <E extends EventsMap>(events: E) =>
  new ResultHandler({
    positive: () => {
      const [first, ...rest] = Object.entries(events).map(([event, schema]) =>
        makeEventSchema(event, schema),
      );
      return {
        mimeType: contentTypes.sse,
        schema: rest.length
          ? z.discriminatedUnion("event", [first, ...rest])
          : first,
      };
    },
    negative: { mimeType: "text/plain", schema: z.string() },
    handler: async ({ response, error, logger, request, input }) => {
      if (error) {
        const httpError = ensureHttpError(error);
        logServerError(httpError, logger, request, input);
        if (!response.headersSent) {
          response
            .status(httpError.statusCode)
            .type("text/plain")
            .write(getPublicErrorMessage(httpError), "utf-8");
        }
      }
      response.end();
    },
  });

export class EventStreamFactory<E extends EventsMap> extends EndpointsFactory<
  undefined,
  Emitter<E>
> {
  constructor(events: E) {
    super(makeResultHandler(events));
    this.middlewares = [makeMiddleware(events)];
  }
}
