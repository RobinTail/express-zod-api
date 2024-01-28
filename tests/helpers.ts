import { map } from "ramda";
import { z } from "zod";
import { SchemaHandler, walkSchema } from "../src/schema-walker";

let lastGivenPort = 8010;
const reservedPorts = {
  example: 8090,
};
export const givePort = (test?: keyof typeof reservedPorts) => {
  if (test && reservedPorts[test]) {
    return reservedPorts[test];
  }
  do {
    lastGivenPort++;
  } while (Object.values(reservedPorts).includes(lastGivenPort));
  return lastGivenPort;
};

export const waitFor = async (cb: () => boolean) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(timer); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject();
    }, 10000);
    const timer = setInterval(() => {
      if (cb()) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve("OK");
      }
    }, 100);
  });

export const serializeSchemaForTest = (
  subject: z.ZodTypeAny,
): Record<string, any> => {
  const onSomeUnion: SchemaHandler<
    | z.ZodUnion<z.ZodUnionOptions>
    | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>,
    object
  > = ({ schema, next }) => ({
    options: Array.from(schema.options.values()).map(next),
  });
  const onOptionalOrNullable: SchemaHandler<
    z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>,
    object
  > = ({ schema, next }) => ({ value: next(schema.unwrap()) });
  const onPrimitive = () => ({});
  return walkSchema({
    schema: subject,
    rules: {
      ZodNull: onPrimitive,
      ZodNumber: onPrimitive,
      ZodString: onPrimitive,
      ZodBoolean: onPrimitive,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodOptional: onOptionalOrNullable,
      ZodNullable: onOptionalOrNullable,
      ZodIntersection: ({ schema, next }) => ({
        left: next(schema._def.left),
        right: next(schema._def.right),
      }),
      ZodObject: ({ schema, next }) => ({ shape: map(next, schema.shape) }),
      ZodEffects: ({ schema, next }) => ({ value: next(schema._def.schema) }),
      ZodRecord: ({ schema, next }) => ({
        keys: next(schema.keySchema),
        values: next(schema.valueSchema),
      }),
      ZodArray: ({ schema, next }) => ({ items: next(schema.element) }),
      ZodLiteral: ({ schema }) => ({ value: schema.value }),
      ZodDefault: ({ schema, next }) => ({
        value: next(schema._def.innerType),
        default: schema._def.defaultValue(),
      }),
      ZodReadonly: ({ schema, next }) => next(schema._def.innerType),
      ZodCatch: ({ schema, next }) => ({
        value: next(schema._def.innerType),
        fallback: schema._def.defaultValue(),
      }),
      ZodPipeline: ({ schema, next }) => ({
        from: next(schema._def.in),
        to: next(schema._def.out),
      }),
    },
    onEach: ({ schema }) => ({ _type: schema._def.typeName }),
    onMissing: ({ schema }) => {
      console.warn(`There is no serializer for ${schema._def.typeName}`);
      return {};
    },
  });
};
