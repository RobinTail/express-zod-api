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

export class ResultHandlerError extends Error {
  public override name = "ResultHandlerError";
  protected readonly originalError?: Error;

  constructor(message: string, originalError?: Error | null) {
    super(message);
    this.originalError = originalError || undefined;
  }

  public hasOriginalError() {
    return this.originalError !== undefined;
  }

  public getOriginalErrorMessage() {
    return this.originalError ? this.originalError.message : undefined;
  }
}
