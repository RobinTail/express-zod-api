import {
  EndpointsFactory,
  arrayResultHandler,
  ResultHandler,
  ez,
  ensureHttpError,
  EventStreamFactory,
  defaultEndpointsFactory,
} from "express-zod-api";
import {
  authMiddleware,
  cookieAssistingMiddleware,
  sessionMiddleware,
} from "./middlewares.ts";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { stat } from "node:fs/promises";

/** @desc This factory extends the default one by enforcing rate limiting and authentication */
export const keyAndTokenAuthenticatedEndpointsFactory = defaultEndpointsFactory
  .useRateLimit({ windowMs: 60000, max: 10 })
  .addMiddleware(authMiddleware);

/** @desc This factory adds session read from cookie into context */
export const cookieAuthenticatedFactory =
  defaultEndpointsFactory.addMiddleware(sessionMiddleware);

/** @desc This factory adds setCookie() helper to context */
export const cookieAssistedFactory = defaultEndpointsFactory.addMiddleware(
  cookieAssistingMiddleware,
);

/** @desc This factory sends the file as string located in the "data" property of the endpoint's output */
export const fileSendingEndpointsFactory = new EndpointsFactory(
  new ResultHandler({
    positive: { schema: z.string(), mimeType: "image/svg+xml" },
    negative: { schema: z.string(), mimeType: "text/plain" },
    handler: ({ response, error, output }) => {
      if (error) return void response.status(400).send(error.message);
      if ("data" in output && typeof output.data === "string")
        response.type("svg").send(output.data);
      else response.status(400).send("Data is missing");
    },
  }),
);

/** @desc This one streams the file using the "filename" property of the endpoint's output */
export const fileStreamingEndpointsFactory = new EndpointsFactory(
  new ResultHandler({
    positive: { schema: ez.buffer(), mimeType: "image/*" },
    negative: { schema: z.string(), mimeType: "text/plain" },
    handler: async ({ response, error, output, request: { method } }) => {
      if (error) return void response.status(400).send(error.message);
      if ("filename" in output && typeof output.filename === "string") {
        const target = response.attachment(output.filename);
        if (method === "HEAD") {
          const { size } = await stat(output.filename);
          return void target.set("Content-Length", `${size}`).end();
        }
        createReadStream(output.filename).pipe(target);
      } else {
        response.status(400).send("Filename is missing");
      }
    },
  }),
);

/**
 * @desc This factory demonstrates the ability to respond with array.
 * @deprecated Avoid doing this in new projects. This feature is only for easier migration of legacy APIs.
 * @alias arrayEndpointsFactory
 */
export const arrayRespondingFactory = new EndpointsFactory(arrayResultHandler);

/** @desc The factory demonstrates slightly different response schemas depending on the negative status code */
export const statusDependingFactory = new EndpointsFactory(
  new ResultHandler({
    positive: (output) => ({
      statusCode: [201, 202], // created or will be created
      schema: output,
    }),
    negative: [
      {
        statusCode: 409, // conflict: entity already exists
        schema: z.object({ id: z.int().describe("id of the existing entity") }),
      },
      {
        statusCode: [400, 500], // validation or internal error
        schema: z.object({ reason: z.string() }),
      },
    ],
    handler: ({ error, response, output }) => {
      if (error) {
        const httpError = ensureHttpError(error);
        const doesExist =
          httpError.statusCode === 409 &&
          "id" in httpError &&
          typeof httpError.id === "number";
        return void response
          .status(httpError.statusCode)
          .json(
            doesExist ? { id: httpError.id } : { reason: httpError.message },
          );
      }
      response.status(201).json(output);
    },
  }),
);

/** @desc This factory demonstrates response without body, such as 204 No Content */
export const noContentFactory = new EndpointsFactory(
  new ResultHandler({
    positive: { statusCode: 204, mimeType: null, schema: z.never() },
    negative: { statusCode: 404, mimeType: null, schema: z.never() },
    handler: ({ error, response }) => {
      response.status(error ? ensureHttpError(error).statusCode : 204).end(); // no content
    },
  }),
);

/** @desc This factory is for producing event streams of server-sent events (SSE) */
export const eventsFactory = new EventStreamFactory({
  time: z.int().positive(),
});
