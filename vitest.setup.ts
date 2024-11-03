import { Config, NewPlugin, Printer, Refs } from "@vitest/pretty-format";
import { isHttpError } from "http-errors";

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

/** Takes cause into account */
const errorSerializer: NewPlugin = {
  test: (subject) => subject instanceof Error && subject.cause !== undefined,
  serialize: (
    { name, message, cause }: Error,
    config,
    indentation,
    depth,
    refs,
    printer,
  ) =>
    `[${name}: ${message}\ncause: ${printer(cause, config, indentation, depth, refs)}]`,
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
