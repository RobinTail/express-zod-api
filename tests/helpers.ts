import { map } from "ramda";
import { z } from "zod";
import { FlatObject } from "../src";
import { ezFileBrand } from "../src/file-schema";
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
      clearInterval(timer);
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

export const serializeSchemaForTest = (subject: z.ZodTypeAny): FlatObject => {
  const onSomeUnion: SchemaHandler<object> = (
    {
      options,
    }:
      | z.ZodUnion<z.ZodUnionOptions>
      | z.ZodDiscriminatedUnion<
          string,
          z.ZodDiscriminatedUnionOption<string>[]
        >,
    { next },
  ) => ({
    options: Array.from(options.values()).map(next),
  });
  const onOptionalOrNullable: SchemaHandler<object> = (
    schema: z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>,
    { next },
  ) => ({
    value: next(schema.unwrap()),
  });
  const onPrimitive = () => ({});
  return walkSchema(subject, {
    rules: {
      ZodNull: onPrimitive,
      ZodNumber: onPrimitive,
      ZodString: onPrimitive,
      ZodBoolean: onPrimitive,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodOptional: onOptionalOrNullable,
      ZodNullable: onOptionalOrNullable,
      ZodIntersection: (
        { _def }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
        { next },
      ) => ({
        left: next(_def.left),
        right: next(_def.right),
      }),
      ZodObject: ({ shape }: z.ZodObject<z.ZodRawShape>, { next }) => ({
        shape: map(next, shape),
      }),
      ZodEffects: ({ _def }: z.ZodEffects<z.ZodTypeAny>, { next }) => ({
        value: next(_def.schema),
      }),
      ZodRecord: ({ keySchema, valueSchema }: z.ZodRecord, { next }) => ({
        keys: next(keySchema),
        values: next(valueSchema),
      }),
      ZodArray: ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) => ({
        items: next(element),
      }),
      ZodLiteral: ({ value }: z.ZodLiteral<unknown>) => ({ value }),
      ZodDefault: ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) => ({
        value: next(_def.innerType),
        default: _def.defaultValue(),
      }),
      ZodReadonly: (schema: z.ZodReadonly<z.ZodTypeAny>, { next }) =>
        next(schema.unwrap()),
      ZodCatch: ({ _def }: z.ZodCatch<z.ZodTypeAny>, { next }) => ({
        value: next(_def.innerType),
      }),
      ZodPipeline: (
        { _def }: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>,
        { next },
      ) => ({
        from: next(_def.in),
        to: next(_def.out),
      }),
      [ezFileBrand]: () => ({ brand: ezFileBrand }),
    },
    onEach: ({ _def }: z.ZodTypeAny) => ({ _type: _def.typeName }),
    onMissing: ({ _def }: z.ZodTypeAny) => {
      console.warn(`There is no serializer for ${_def.typeName}`);
      return {};
    },
  });
};
