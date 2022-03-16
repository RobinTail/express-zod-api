import mime from "mime";
import { defaultEndpointsFactory, EndpointsFactory, z } from "../src";
import { ResultHandlerDefinition } from "../src/result-handler";
import { authMiddleware } from "./middlewares";
import fs from "fs";

export const keyAndTokenAuthenticatedEndpointsFactory =
  defaultEndpointsFactory.addMiddleware(authMiddleware);

export const fileSendingEndpointsFactory = new EndpointsFactory(
  new ResultHandlerDefinition({
    mimeTypes: {
      positive: mime.getType("svg") || "image/svg+xml",
      negative: mime.getType("txt") || "text/plain",
    },
    getPositiveResponse: () => z.string(),
    negativeResponse: z.string(),
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
  new ResultHandlerDefinition({
    mimeTypes: {
      positive: "image/*",
      negative: mime.getType("txt") || "text/plain",
    },
    getPositiveResponse: () => z.file().binary(),
    negativeResponse: z.string(),
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
