import mime from "mime";
import {
  createResultHandler,
  defaultEndpointsFactory,
  EndpointsFactory,
  z,
} from "../src";
import { authMiddleware } from "./middlewares";
import fs from "fs";

export const keyAndTokenAuthenticatedEndpointsFactory =
  defaultEndpointsFactory.addMiddleware(authMiddleware);

export const fileSendingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    positiveMimeTypes: [mime.getType("svg") || "image/svg+xml"],
    negativeMimeTypes: [mime.getType("txt") || "text/plain"],
    getPositiveResponse: () => z.string(),
    getNegativeResponse: () => z.string(),
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
    positiveMimeTypes: ["image/*"],
    negativeMimeTypes: [mime.getType("txt") || "text/plain"],
    getPositiveResponse: () => z.file().binary(),
    getNegativeResponse: () => z.string(),
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
