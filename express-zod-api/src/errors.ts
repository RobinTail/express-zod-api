import { z } from "zod";
import { getMessageFromError } from "./common-helpers.ts";
import { OpenAPIContext } from "./documentation-helpers.ts";
import type { Method } from "./method.ts";

/** @desc An error related to the wrong Routing declaration */
export class RoutingError extends Error {
  public override name = "RoutingError";
  public override readonly cause: { method: Method; path: string };

  constructor(message: string, method: Method, path: string) {
    super(message);
    this.cause = { method, path };
  }
}

/**
 * @desc An error related to the generating of the documentation
 * */
export class DocumentationError extends Error {
  public override name = "DocumentationError";
  public override readonly cause: string;

  constructor(
    message: string,
    {
      method,
      path,
      isResponse,
    }: Pick<OpenAPIContext, "path" | "method" | "isResponse">,
  ) {
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

export class DeepCheckError extends IOSchemaError {
  public override name = "DeepCheckError";
  public override readonly cause: z.core.$ZodType;

  constructor(cause: z.core.$ZodType) {
    super("Found", { cause });
    this.cause = cause;
  }
}

/** @desc An error of validating the Endpoint handler's returns against the Endpoint output schema */
export class OutputValidationError extends IOSchemaError {
  public override name = "OutputValidationError";
  public override readonly cause: z.ZodError;

  constructor(cause: z.ZodError) {
    const prefixedPath = new z.ZodError(
      cause.issues.map(({ path, ...rest }) => ({
        ...rest,
        path: ["output", ...path],
      })),
    );
    super(getMessageFromError(prefixedPath), { cause });
    this.cause = cause;
  }
}

/** @desc An error of validating the input sources against the Middleware or Endpoint input schema */
export class InputValidationError extends IOSchemaError {
  public override name = "InputValidationError";
  public override readonly cause: z.ZodError;

  constructor(cause: z.ZodError) {
    super(getMessageFromError(cause), { cause });
    this.cause = cause;
  }
}

/** @desc An error related to the execution or incorrect configuration of ResultHandler */
export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";
  public override readonly cause: Error;
  public readonly handled?: Error;

  constructor(
    /** @desc The error thrown from ResultHandler */
    cause: Error,
    /** @desc The error being processed by ResultHandler when it failed */
    handled?: Error,
  ) {
    super(getMessageFromError(cause), { cause });
    this.cause = cause;
    this.handled = handled;
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
