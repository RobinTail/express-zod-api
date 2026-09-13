import type { Response } from "express";
import { z } from "zod";
import type { FlatObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { EndpointsFactory } from "./endpoints-factory";
import { Middleware } from "./middleware";
import { ResultHandler } from "./result-handler";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "./result-helpers";
import { ResultHandlerError } from "./errors";

/** @desc The declaration mapping the event names to the schemas of their data. */
type EventsMap = Record<string, z.ZodType>;

export interface Emitter<E extends EventsMap> extends FlatObject {
  /** @desc Returns true when the connection was closed or terminated */
  isClosed: () => boolean;
  /** @desc Abort signal bound to the client connection lifecycle */
  signal: AbortSignal;
  /**
   * @desc The value of the `Last-Event-ID` request header when `eventId` is enabled.
   * @see EventStreamFactoryOptions#eventId
   * */
  lastEventId?: string;
  /** @desc Sends an event to the stream according to the declared schema */
  emit: <K extends keyof E>(event: K, data: z.input<E[K]>) => void;
}

export const makeMessageSchema = (event: string, data: z.ZodType) =>
  z.object({
    data,
    event: z.literal(event),
    id: z.string().optional(),
    retry: z.int().positive().optional(),
  });

const invalidSSEChars = /[\r\n\0]/g;

interface MessageProps {
  events: EventsMap;
  event: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export const formatMessage = ({
  events,
  event,
  data,
  id,
  retry,
}: MessageProps) => {
  if (!Object.prototype.hasOwnProperty.call(events, event))
    throw new Error(`Unknown event: ${event}`);
  const payload = events[event]!.parse(data); // ensured by hasOwnProperty
  let message = `event: ${event}\n`;
  if (id !== undefined) message += `id: ${id}\n`;
  if (retry !== undefined) message += `retry: ${retry}\n`;
  return message + `data: ${JSON.stringify(payload)}\n\n`;
};

const headersTimeout = 1e4; // 10s to respond with a status code other than 200
export const ensureStream = (response: Response) =>
  response.headersSent ||
  response.writeHead(200, {
    connection: "keep-alive",
    "content-type": contentTypes.sse,
    "cache-control": "no-cache",
  });

type EventIdHook = (event: string, seq: number) => string;

export const makeMiddleware = <E extends EventsMap>(
  events: E,
  { eventId = false, retry }: EventStreamFactoryOptions = {},
) => {
  let counter = 0;
  let getId: EventIdHook | undefined;
  if (eventId) {
    if (typeof eventId === "function")
      getId = (event, seq) => eventId(event, seq).replace(invalidSSEChars, "");
    else getId = (event, seq) => `${event}##${seq}`;
  }
  return new Middleware({
    handler: async ({ request, response }): Promise<Emitter<E>> => {
      const controller = new AbortController();
      const timer = setTimeout(() => ensureStream(response), headersTimeout);

      request.once("close", () => {
        clearTimeout(timer);
        controller.abort();
      });

      const lastEventId =
        getId && typeof request.headers["last-event-id"] === "string"
          ? request.headers["last-event-id"]
          : undefined;

      return {
        isClosed: () => response.writableEnded || response.closed,
        signal: controller.signal,
        emit: (event, data) => {
          ensureStream(response);
          const id = getId && getId(String(event), ++counter);
          response.write(
            formatMessage({
              events,
              event: String(event),
              data,
              id,
              retry,
            }),
            "utf-8",
          );
          /**
           * Issue 2347: flush is the method of compression, it must be called only when compression is enabled
           * @link https://github.com/RobinTail/express-zod-api/issues/2347
           * */
          response.flush?.();
        },
        ...(lastEventId ? { lastEventId } : {}),
      };
    },
  });
};

export const makeResultHandler = <E extends EventsMap>(events: E) =>
  new ResultHandler({
    positive: () => {
      const [first, ...rest] = Object.entries(events).map(([event, schema]) =>
        makeMessageSchema(event, schema),
      );
      if (!first) {
        const cause = new Error("At least one SSE event is required.");
        throw new ResultHandlerError(cause);
      }
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

/** @desc The options of the `EventStreamFactory`. */
export interface EventStreamFactoryOptions {
  /**
   * @desc Configures a unique id for every SSE message. Must not contain line breaks or null characters.
   * @default false — the ids are not assigned
   * @example true — enables the default ids: `${event}##${counter}`
   * @example (event, seq) => `${event}.${seq}@${Date.now()}`
   * */
  eventId?: boolean | EventIdHook;
  /**
   * @desc Tells a client how long to wait before reconnecting on connection loss (milliseconds).
   * @example 3e3 — the client waits 3 seconds before reconnecting
   * */
  retry?: number;
}

export class EventStreamFactory<E extends EventsMap> extends EndpointsFactory<
  undefined,
  Emitter<E>
> {
  /** @todo compile these schemas in v30 */
  constructor(events: E, { eventId, retry }: EventStreamFactoryOptions = {}) {
    for (const name of Object.keys(events)) {
      if (name.match(invalidSSEChars)) {
        throw new Error(
          `Invalid SSE event name "${name}": must not contain line breaks or null characters.`,
        );
      }
    }
    if (retry !== undefined && !(Number.isInteger(retry) && retry > 0)) {
      throw new Error(
        `Invalid SSE retry value "${retry}": must be a positive integer.`,
      );
    }
    super(makeResultHandler(events));
    this.middlewares = [makeMiddleware(events, { eventId, retry })];
  }
}
