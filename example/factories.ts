import { lookup } from "mime-types";
import {
  EndpointsFactory,
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
      mimeType: lookup("svg") || "image/svg+xml",
    }),
    getNegativeResponse: () => ({
      schema: z.string(),
      mimeType: lookup("txt") || "text/plain",
    }),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if ("data" in output) {
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
      mimeType: lookup("txt") || "text/plain",
    }),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if ("filename" in output) {
        createReadStream(output.filename).pipe(response.type(output.filename));
      } else {
        response.status(400).send("Filename is missing");
      }
    },
  }),
});
