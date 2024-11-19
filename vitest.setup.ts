import type { NewPlugin } from "@vitest/pretty-format";
import { isHttpError } from "http-errors";
import { z } from "zod";
import { ResultHandlerError } from "./src/errors";
import { metaSymbol } from "./src/metadata";

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

const makeSchemaSerializer = <T extends z.ZodTypeAny>(
  Cls: { new (...args: any[]): T },
  fn: (subject: T) => object,
): NewPlugin => ({
  test: (subject) => subject instanceof Cls,
  serialize: (
    subject: z.ZodTypeAny,
    config,
    indentation,
    depth,
    refs,
    printer,
  ) =>
    printer(
      Object.assign(fn(subject as T), { _type: subject._def.typeName }),
      config,
      indentation,
      depth,
      refs,
    ),
});

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
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodObject, ({ shape }) => ({ shape })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodLiteral, ({ value }) => ({ value })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodIntersection, ({ _def: { left, right } }) => ({
    left,
    right,
  })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodUnion, ({ options }) => ({ options })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodEffects, ({ _def: { schema: value } }) => ({
    value,
  })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodOptional, (schema) => ({ value: schema.unwrap() })),
);
expect.addSnapshotSerializer(
  makeSchemaSerializer(z.ZodBranded, ({ _def }) => ({
    brand: _def[metaSymbol]?.brand,
  })),
);
expect.addSnapshotSerializer(makeSchemaSerializer(z.ZodNumber, () => ({})));
expect.addSnapshotSerializer(makeSchemaSerializer(z.ZodString, () => ({})));
expect.addSnapshotSerializer(makeSchemaSerializer(z.ZodBoolean, () => ({})));
expect.addSnapshotSerializer(makeSchemaSerializer(z.ZodNull, () => ({})));
