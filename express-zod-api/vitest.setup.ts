import "./src/zod-plugin"; // required for tests importing sources using the plugin methods
import type { NewPlugin } from "@vitest/pretty-format";
import { z } from "zod";
import { ResultHandlerError } from "./src/errors";
import { metaSymbol } from "./src/metadata";

/** Takes cause and certain props of custom errors into account */
const errorSerializer: NewPlugin = {
  test: (subject) => subject instanceof Error,
  serialize: (error: Error, config, indentation, depth, refs, printer) => {
    const { name, message, cause } = error;
    const { handled } = error instanceof ResultHandlerError ? error : {};
    const obj = Object.assign(
      { message },
      cause && { cause },
      handled && { handled },
    );
    return `${name}(${printer(obj, config, indentation, depth, refs)})`;
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
    test: (entity) => classes.some((Cls) => entity instanceof Cls),
    serialize: (entity, config, indentation, depth, refs, printer) => {
      const obj = Object.assign(fn(entity as C), {
        _type: entity._def.typeName,
      });
      return printer(obj, config, indentation, depth, refs);
    },
  };
};

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
  makeSchemaSerializer(
    z.ZodDiscriminatedUnion,
    ({ options, discriminator }) => ({ discriminator, options }),
  ),
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
