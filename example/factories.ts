import mime from "mime";
import {
  defaultEndpointsFactory,
  EndpointsFactory,
  z,
  AbstractResultHandler,
  ResultHandlerParams,
} from "../src";
import { Hkt } from "../src/hkt";
import { authMiddleware } from "./middlewares";
import fs from "fs";

// @todo make it neat

export const keyAndTokenAuthenticatedEndpointsFactory =
  defaultEndpointsFactory.addMiddleware(authMiddleware);

interface FSResultHandlerHkt
  extends Hkt<unknown, FileSendingResultHandler<any>> {
  [Hkt.output]: FileSendingResultHandler<Hkt.Input<this>>;
}

class FileSendingResultHandler<T> extends AbstractResultHandler<T> {
  static hkt: FSResultHandlerHkt;
  mimeTypes = {
    positive: [mime.getType("svg") || "image/svg+xml"],
    negative: [mime.getType("txt") || "text/plain"],
  };
  positiveResponse = z.lazy(() => z.string());
  negativeResponse = z.string();
  handler({
    response,
    error,
    output,
  }: ResultHandlerParams<
    z.output<this["positiveResponse"]> | z.output<this["negativeResponse"]>
  >) {
    if (error) {
      response.status(400).send(error.message);
      return;
    }
    if ("data" in output) {
      response.type("svg").send(output.data);
    } else {
      response.status(400).send("Data is missing");
    }
  }
}

export const fileSendingEndpointsFactory = new EndpointsFactory(
  FileSendingResultHandler
);

interface FEResultHandlerHkt
  extends Hkt<unknown, FileStreamingResultHandler<any>> {
  [Hkt.output]: FileStreamingResultHandler<Hkt.Input<this>>;
}

class FileStreamingResultHandler<T> extends AbstractResultHandler<T> {
  static hkt: FEResultHandlerHkt;
  mimeTypes = {
    positive: ["image/*"],
    negative: [mime.getType("txt") || "text/plain"],
  };
  positiveResponse = z.lazy(() => z.file().binary());
  negativeResponse = z.string();
  handler({
    response,
    error,
    output,
  }: ResultHandlerParams<
    z.output<this["positiveResponse"]> | z.output<this["negativeResponse"]>
  >) {
    if (error) {
      response.status(400).send(error.message);
      return;
    }
    if ("filename" in output) {
      fs.createReadStream(output.filename).pipe(response.type(output.filename));
    } else {
      response.status(400).send("Filename is missing");
    }
  }
}

export const fileStreamingEndpointsFactory = new EndpointsFactory(
  FileStreamingResultHandler
);
