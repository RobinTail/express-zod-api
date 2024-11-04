import type { NewPlugin } from "@vitest/pretty-format";
import { isHttpError } from "http-errors";
import { ResultHandlerError } from "./src/errors";

/** Takes statusCode into account */
const compareHttpErrors = (a: unknown, b: unknown) => {
  const hasCodeA = isHttpError(a);
  const hasCodeB = isHttpError(b);
  return hasCodeA && hasCodeB
    ? a.statusCode === b.statusCode && a.message === b.message
    : hasCodeA === hasCodeB
      ? undefined
      : false;
};

/** Takes cause and certain props of custom errors into account */
const errorSerializer: NewPlugin = {
  test: (subject) => subject instanceof Error,
  serialize: (error: Error, config, indentation, depth, refs, printer) => {
    const { name, message, cause } = error;
    const { handled } = error instanceof ResultHandlerError ? error : {};
    const asObject = {
      message,
      ...(cause ? { cause } : {}),
      ...(handled ? { handled } : {}),
    };
    return `${name}(${printer(asObject, config, indentation, depth, refs)})`;
  },
};

/**
 * @see https://vitest.dev/api/expect.html#expect-addequalitytesters
 * @see https://jestjs.io/docs/expect#expectaddequalitytesterstesters
 * */
expect.addEqualityTesters([compareHttpErrors]);

/**
 * @see https://github.com/vitest-dev/vitest/issues/5697
 * @see https://vitest.dev/guide/snapshot.html#custom-serializer
 */
expect.addSnapshotSerializer(errorSerializer);
