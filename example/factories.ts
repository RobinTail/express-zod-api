import mime from "mime";
import {
  EndpointsFactory,
  arrayResultHandler,
  createResultHandler,
  defaultResultHandler,
  ez,
} from "../src";
import { config } from "./config";
import { authMiddleware } from "./middlewares";
import { createReadStream } from "node:fs";
import { z } from "zod";

export const taggedEndpointsFactory = new EndpointsFactory({
  resultHandler: defaultResultHandler,
  config,
});

export const keyAndTokenAuthenticatedEndpointsFactory =
  taggedEndpointsFactory.addMiddleware(authMiddleware);

export const fileSendingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: createResultHandler({
    getPositiveResponse: () => ({
      schema: z.string(),
      mimeType: mime.getType("svg") || "image/svg+xml",
    }),
    getNegativeResponse: () => ({
      schema: z.string(),
      mimeType: mime.getType("txt") || "text/plain",
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

export const fileStreamingEndpointsFactory = new EndpointsFactory({
  config,
  resultHandler: createResultHandler({
    getPositiveResponse: () => ({
      schema: ez.file().binary(),
      mimeType: "image/*",
    }),
    getNegativeResponse: () => ({
      schema: z.string(),
      mimeType: mime.getType("txt") || "text/plain",
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

export const arrayRespondingFactory = new EndpointsFactory({
  config,
  resultHandler: arrayResultHandler,
});
