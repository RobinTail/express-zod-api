import { isHttpError } from "http-errors";
import { z } from "zod";
import { InputValidationError, OutputValidationError } from "./errors";

export const getStatusCodeFromError = (error: Error): number => {
  if (isHttpError(error)) {
    return error.statusCode;
  }
  if (error instanceof InputValidationError) {
    return 400;
  }
  return 500;
};

export const getMessageFromError = (error: Error): string => {
  if (error instanceof z.ZodError) {
    return error.issues
      .map(({ path, message }) =>
        (path.length ? [path.join("/")] : []).concat(message).join(": "),
      )
      .join("; ");
  }
  if (error instanceof OutputValidationError) {
    const hasFirstField = error.originalError.issues[0]?.path.length > 0;
    return `output${hasFirstField ? "/" : ": "}${error.message}`;
  }
  return error.message;
};
