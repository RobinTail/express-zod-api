import mime from "mime";
import {
  EndpointsFactory,
  createResultHandler,
  defaultResultHandler,
  z,
} from "../src";
import { config } from "./config";
import { authMiddleware } from "./middlewares";
import fs from "fs";

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
      schema: z.file().binary(),
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
      if ("filename" in output) {
        fs.createReadStream(output.filename).pipe(
          response.type(output.filename)
        );
      } else {
        response.status(400).send("Filename is missing");
      }
    },
  }),
});
