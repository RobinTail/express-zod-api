import { HttpError } from "http-errors";
import { getMessageFromError } from "./common-helpers";
import { OpenAPIContext } from "./documentation-helpers";

/** @desc An error related to the wrong Routing declaration */
export class RoutingError extends Error {
  public override name = "RoutingError";
}

/**
 * @desc An error related to the generating of the documentation
 * */
export class DocumentationError extends Error {
  public override name = "DocumentationError";
  public override readonly cause: string;

  constructor({
    message,
    method,
    path,
    isResponse,
  }: { message: string } & Pick<
    OpenAPIContext,
    "path" | "method" | "isResponse"
  >) {
    super(message);
    this.cause = `${
      isResponse ? "Response" : "Input"
    } schema of an Endpoint assigned to ${method.toUpperCase()} method of ${path} path.`;
  }
}

/** @desc An error related to the input and output schemas declaration */
export class IOSchemaError extends Error {
  public override name = "IOSchemaError";
}

/** @desc An error related to the execution or incorrect configuration of ResultHandler */
export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";

  constructor(
    /** @desc The error thrown from ResultHandler */
    public override readonly cause: Error,
    /** @desc The error being processed by ResultHandler when it failed */
    public readonly handled?: HttpError,
  ) {
    super(getMessageFromError(cause), { cause });
  }
}

export class MissingPeerError extends Error {
  public override name = "MissingPeerError";
  constructor(module: string) {
    super(
      `Missing peer dependency: ${module}. Please install it to use the feature.`,
    );
  }
}
