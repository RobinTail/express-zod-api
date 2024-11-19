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

const makeSchemaSerializer = <
  C extends z.ZodType,
  T extends { new (...args: any[]): C }[],
>(
  subject: T | T[number],
  fn: (subject: C) => object,
): NewPlugin => {
  const classes = Array.isArray(subject) ? subject : [subject];
  return {
    test: (subject) => classes.some((Cls) => subject instanceof Cls),
    serialize: (subject, config, indentation, depth, refs, printer) =>
      printer(
        Object.assign(fn(subject as C), { _type: subject._def.typeName }),
        config,
        indentation,
        depth,
        refs,
      ),
  };
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
const serializers = [
  errorSerializer,
  makeSchemaSerializer(z.ZodObject, ({ shape }) => ({ shape })),
  makeSchemaSerializer(z.ZodLiteral, ({ value }) => ({ value })),
  makeSchemaSerializer(z.ZodIntersection, ({ _def: { left, right } }) => ({
    left,
    right,
  })),
  makeSchemaSerializer(z.ZodUnion, ({ options }) => ({ options })),
  makeSchemaSerializer(z.ZodEffects, ({ _def: { schema: value } }) => ({
    value,
  })),
  makeSchemaSerializer(z.ZodOptional, (schema) => ({ value: schema.unwrap() })),
  makeSchemaSerializer(z.ZodBranded, ({ _def }) => ({
    brand: _def[metaSymbol]?.brand,
  })),
  makeSchemaSerializer(
    [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull],
    () => ({}),
  ),
];
for (const serializer of serializers) expect.addSnapshotSerializer(serializer);
