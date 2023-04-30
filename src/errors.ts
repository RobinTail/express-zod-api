import { ZodError } from "zod";
import { getMessageFromError } from "./common-helpers";

/** @desc An error related to the wrong Routing declaration */
export class RoutingError extends Error {
  public override name = "RoutingError";
}

/** @desc An error related to the issues of using DependsOnMethod class */
export class DependsOnMethodError extends RoutingError {
  public override name = "DependsOnMethodError";
}

/**
 * @desc An error related to the generating of the documentation
 * @todo rename to DocumentationError in v11
 * */
export class OpenAPIError extends Error {
  public override name = "OpenAPIError";
}

/** @desc An error related to the input and output schemas declaration */
export class IOSchemaError extends Error {
  public override name = "IOSchemaError";
}

/** @desc An error of validating the Endpoint handler's returns against the Endpoint output schema */
export class OutputValidationError extends IOSchemaError {
  public override name = "OutputValidationError";
  public readonly originalError: ZodError;

  constructor(originalError: ZodError) {
    super(getMessageFromError(originalError));
    this.originalError = originalError;
  }
}

/** @desc An error of validating the input sources against the Middleware or Endpoint input schema */
export class InputValidationError extends IOSchemaError {
  public override name = "InputValidationError";
  public readonly originalError: ZodError;

  constructor(originalError: ZodError) {
    super(getMessageFromError(originalError));
    this.originalError = originalError;
  }
}

/** @desc An error related to the execution of ResultHandler */
export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";
  public readonly originalError: Error | undefined;

  constructor(message: string, originalError?: Error | null) {
    super(message);
    this.originalError = originalError || undefined;
  }
}
