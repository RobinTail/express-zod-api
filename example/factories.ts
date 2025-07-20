import {
  EndpointsFactory,
  arrayResultHandler,
  ResultHandler,
  ez,
  ensureHttpError,
  EventStreamFactory,
  defaultEndpointsFactory,
} from "express-zod-api";
import { authMiddleware } from "./middlewares";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { z } from "zod/v4";

/** @desc This factory extends the default one by enforcing the authentication using the specified middleware */
export const keyAndTokenAuthenticatedEndpointsFactory =
  defaultEndpointsFactory.addMiddleware(authMiddleware);

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
    positive: (data) => ({
      statusCode: [201, 202],
      schema: z.object({ status: z.literal("created"), data }),
    }),
    negative: [
      {
        statusCode: 409,
        schema: z.object({ status: z.literal("exists"), id: z.int() }),
      },
      {
        statusCode: [400, 500],
        schema: z.object({ status: z.literal("error"), reason: z.string() }),
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
            doesExist
              ? { status: "exists", id: httpError.id }
              : { status: "error", reason: httpError.message },
          );
      }
      response.status(201).json({ status: "created", data: output });
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
