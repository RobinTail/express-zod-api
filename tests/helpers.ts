import jestConfig from "../jest.config.json";
import { z } from "zod";
import { SchemaHandler, walkSchema } from "../express-zod-api/src/schema-walker";

let lastGivenPort = 8010;
const reservedPorts = {
  esm: 8070,
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
    }, jestConfig.testTimeout);
    const timer = setInterval(() => {
      if (cb()) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve("OK");
      }
    }, 100);
  });

export const serializeSchemaForTest = (
  schema: z.ZodTypeAny,
): Record<string, any> => {
  const onSomeUnion: SchemaHandler<
    z.ZodUnion<any> | z.ZodDiscriminatedUnion<any, any>,
    object
  > = ({ schema: subject, next }) => ({
    options: Array.from(subject.options.values()).map((option) =>
      next({ schema: option as z.ZodTypeAny }),
    ),
  });
  const onOptionalOrNullable: SchemaHandler<
    z.ZodOptional<any> | z.ZodNullable<any>,
    object
  > = ({ schema: subject, next }) => ({
    value: next({ schema: subject.unwrap() }),
  });
  const onPrimitive = () => ({});
  return walkSchema({
    schema,
    rules: {
      ZodNull: onPrimitive,
      ZodNumber: onPrimitive,
      ZodString: onPrimitive,
      ZodBoolean: onPrimitive,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodOptional: onOptionalOrNullable,
      ZodNullable: onOptionalOrNullable,
      ZodIntersection: ({ schema: subject, next }) => ({
        left: next({ schema: subject._def.left }),
        right: next({ schema: subject._def.right }),
      }),
      ZodObject: ({ schema: subject, next }) => ({
        shape: Object.keys(subject.shape).reduce(
          (carry, key) => ({
            ...carry,
            [key]: next({ schema: subject.shape[key] }),
          }),
          {},
        ),
      }),
      ZodEffects: ({ schema: subject, next }) => ({
        value: next({ schema: subject._def.schema }),
      }),
      ZodRecord: ({ schema: subject, next }) => ({
        keys: next({ schema: subject.keySchema }),
        values: next({ schema: subject.valueSchema }),
      }),
      ZodArray: ({ schema: subject, next }) => ({
        items: next({ schema: subject.element }),
      }),
      ZodLiteral: ({ schema: subject }) => ({ value: subject.value }),
      ZodDefault: ({ schema: subject, next }) => ({
        value: next({ schema: subject._def.innerType }),
        default: schema._def.defaultValue(),
      }),
      ZodReadonly: ({ schema: subject, next }) =>
        next({ schema: subject._def.innerType }),
      ZodCatch: ({ schema: subject, next }) => ({
        value: next({ schema: subject._def.innerType }),
        fallback: schema._def.defaultValue(),
      }),
      ZodPipeline: ({ schema: subject, next }) => ({
        from: next({ schema: subject._def.in }),
        to: next({ schema: subject._def.out }),
      }),
    },
    onEach: ({ schema: subject }) => ({ _type: subject._def.typeName }),
    onMissing: ({ schema: subject }) => {
      console.warn(`There is no serializer for ${subject._def.typeName}`);
      return {};
    },
  });
};
