export class RoutingError extends Error {
}

export class DependsOnMethodError extends RoutingError {
}

export class OpenAPIError extends Error {
}

export class ResultHandlerError extends Error {
  protected readonly originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message);
    this.originalError = originalError;
  }

  public hasOriginalError() {
    return this.originalError !== undefined;
  }

  public getOriginalErrorMessage() {
    return this.originalError ? this.originalError.message : undefined;
  }
}
