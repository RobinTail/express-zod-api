import { z } from "zod";
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

  constructor({
    message,
    method,
    path,
    isResponse,
  }: { message: string } & Pick<
    OpenAPIContext,
    "path" | "method" | "isResponse"
  >) {
    const finalMessage = `${message}\nCaused by ${
      isResponse ? "response" : "input"
    } schema of an Endpoint assigned to ${method.toUpperCase()} method of ${path} path.`;
    super(finalMessage);
  }
}

/** @desc An error related to the input and output schemas declaration */
export class IOSchemaError extends Error {
  public override name = "IOSchemaError";
}

/** @desc An error of validating the Endpoint handler's returns against the Endpoint output schema */
export class OutputValidationError extends IOSchemaError {
  public override name = "OutputValidationError";

  constructor(public override readonly cause: z.ZodError) {
    super(getMessageFromError(cause), { cause });
  }

  /**
   * @deprecated use the cause property instead
   * @todo remove in v21
   * */
  public get originalError() {
    return this.cause;
  }
}

/** @desc An error of validating the input sources against the Middleware or Endpoint input schema */
export class InputValidationError extends IOSchemaError {
  public override name = "InputValidationError";

  constructor(public override readonly cause: z.ZodError) {
    super(getMessageFromError(cause), { cause });
  }

  /**
   * @deprecated use the cause property instead
   * @todo remove in v21
   * */
  public get originalError() {
    return this.cause;
  }
}

/** @desc An error related to the execution or incorrect configuration of ResultHandler */
export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";

  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message, { cause });
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
