import {
  EndpointsFactory,
  arrayResultHandler,
  ResultHandler,
  defaultResultHandler,
  ez,
  ensureHttpError,
} from "../src";
import { config } from "./config";
import { authMiddleware } from "./middlewares";
import { createReadStream } from "node:fs";
import { z } from "zod";

/** @desc The factory assures the endpoints tagging constraints from config */
export const taggedEndpointsFactory = new EndpointsFactory({
  resultHandler: defaultResultHandler,
  config,
});

/** @desc This one extends the previous one by enforcing the authentication using the specified middleware */
export const keyAndTokenAuthenticatedEndpointsFactory =
  taggedEndpointsFactory.addMiddleware(authMiddleware);

/** @desc This factory sends the file as string located in the "data" property of the endpoint's output */
export const fileSendingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: new ResultHandler({
    positive: { schema: z.string(), mimeType: "image/svg+xml" },
    negative: { schema: z.string(), mimeType: "text/plain" },
    handler: ({ response, error, output }) => {
      if (error) return void response.status(400).send(error.message);
      if (output && "data" in output && typeof output.data === "string")
        response.type("svg").send(output.data);
      else response.status(400).send("Data is missing");
    },
  }),
});

/** @desc This one streams the file using the "filename" property of the endpoint's output */
export const fileStreamingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: new ResultHandler({
    positive: { schema: ez.file("buffer"), mimeType: "image/*" },
    negative: { schema: z.string(), mimeType: "text/plain" },
    handler: ({ response, error, output }) => {
      if (error) return void response.status(400).send(error.message);
      if (output && "filename" in output && typeof output.filename === "string")
        createReadStream(output.filename).pipe(response.type(output.filename));
      else response.status(400).send("Filename is missing");
    },
  }),
});

/**
 * @desc This endpoint demonstrates the ability to respond with array.
 * @deprecated Avoid doing this in new projects. This feature is only for easier migration of legacy APIs.
 * @alias arrayEndpointsFactory
 */
export const arrayRespondingFactory = new EndpointsFactory({
  config,
  resultHandler: arrayResultHandler,
});

/** @desc The factory demonstrates slightly different response schemas depending on the negative status code */
export const statusDependingFactory = new EndpointsFactory({
  config,
  resultHandler: new ResultHandler({
    positive: (data) => ({
      statusCodes: [201, 202],
      schema: z.object({ status: z.literal("created"), data }),
    }),
    negative: [
      {
        statusCode: 409,
        schema: z.object({ status: z.literal("exists"), id: z.number().int() }),
      },
      {
        statusCodes: [400, 500],
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
});
