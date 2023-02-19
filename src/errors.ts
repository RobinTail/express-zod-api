import { ZodError } from "zod";
import { getMessageFromError } from "./common-helpers";

export class RoutingError extends Error {
  public override name = "RoutingError";
}

export class DependsOnMethodError extends RoutingError {
  public override name = "DependsOnMethodError";
}

export class OpenAPIError extends Error {
  public override name = "OpenAPIError";
}

export class IOSchemaError extends Error {
  public override name = "IOSchemaError";
}

export class OutputValidationError extends IOSchemaError {
  public override name = "OutputValidationError";
}

export class EndpointHandlerZodError extends Error {
  public override name = "EndpointHandlerZodError";
  public readonly originalError: ZodError;

  constructor(originalError: ZodError) {
    super(getMessageFromError(originalError));
    this.originalError = originalError;
  }
}

export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";
  public readonly originalError: Error | undefined;

  constructor(message: string, originalError?: Error | null) {
    super(message);
    this.originalError = originalError || undefined;
  }
}
