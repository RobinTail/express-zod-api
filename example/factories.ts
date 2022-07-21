import mime from "mime";
import {
  createApiResponse,
  createResultHandler,
  defaultEndpointsFactory,
  EndpointsFactory,
  z,
} from "../src/index.js";
import { authMiddleware } from "./middlewares.js";
import fs from "node:fs";

export const keyAndTokenAuthenticatedEndpointsFactory =
  defaultEndpointsFactory.addMiddleware(authMiddleware);

export const fileSendingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () =>
      createApiResponse(z.string(), mime.getType("svg") || "image/svg+xml"),
    getNegativeResponse: () =>
      createApiResponse(z.string(), mime.getType("txt") || "text/plain"),
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
  })
);

export const fileStreamingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => createApiResponse(z.file().binary(), "image/*"),
    getNegativeResponse: () =>
      createApiResponse(z.string(), mime.getType("txt") || "text/plain"),
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
  })
);
