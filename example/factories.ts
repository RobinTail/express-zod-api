import {
  EndpointsFactory,
  arrayResultHandler,
  createResultHandler,
  defaultResultHandler,
  ez,
  getStatusCodeFromError,
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

/** @desc This one extends the previois one by enforcing the authentication using the specified middleware */
export const keyAndTokenAuthenticatedEndpointsFactory =
  taggedEndpointsFactory.addMiddleware(authMiddleware);

/** @desc This factory sends the file as string located in the "data" property of the endpoint's output */
export const fileSendingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: createResultHandler({
    getPositiveResponse: () => ({
      schema: z.string(),
      mimeType: "image/svg+xml",
    }),
    getNegativeResponse: () => ({
      schema: z.string(),
      mimeType: "text/plain",
    }),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if (output && "data" in output && typeof output.data === "string") {
        response.type("svg").send(output.data);
      } else {
        response.status(400).send("Data is missing");
      }
    },
  }),
});

/** @desc This one streams the file using the "filename" property of the endpoint's output */
export const fileStreamingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: createResultHandler({
    getPositiveResponse: () => ({
      schema: ez.file().buffer(),
      mimeType: "image/*",
    }),
    getNegativeResponse: () => ({
      schema: z.string(),
      mimeType: "text/plain",
    }),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if (
        output &&
        "filename" in output &&
        typeof output.filename === "string"
      ) {
        createReadStream(output.filename).pipe(response.type(output.filename));
      } else {
        response.status(400).send("Filename is missing");
      }
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

/** @desc The factory having slightly different response schemas depending on the status code */
export const statusDependingFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: (output) => [
      {
        statusCode: 200,
        schema: z.object({ status: z.literal("ok"), data: output }),
      },
      {
        statusCode: 201,
        schema: z.object({ status: z.literal("created"), data: output }),
      },
    ],
    getNegativeResponse: () => [
      {
        statusCode: 400,
        schema: z.object({ status: z.literal("error"), message: z.string() }),
      },
      {
        statusCode: 500,
        schema: z.object({ status: z.literal("failure"), reason: z.string() }),
      },
    ],
    handler: ({ error, response, output }) => {
      if (error) {
        const code = getStatusCodeFromError(error);
        response
          .status(code)
          .json(
            code >= 500
              ? { status: "failure", reason: error.message }
              : { status: "error", message: error.message },
          );
        return;
      }
      response.status(201).json({ status: "created", data: output });
    },
  }),
);
