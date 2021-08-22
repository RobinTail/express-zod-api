import jestConfig from '../jest.config';
import {z} from '../src';

export const waitFor = async (cb: () => boolean) =>
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(timer);
      reject();
    }, jestConfig.testTimeout);
    const timer = setInterval(() => {
      if (cb()) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve('OK');
      }
    }, 100);
  });

export const delay = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

export const serializeSchemaForTest = (schema: z.ZodTypeAny): Record<string, any> => {
  const getDescription = () => {
    if (schema instanceof z.ZodIntersection) {
      return {
        left: serializeSchemaForTest(schema._def.left),
        right: serializeSchemaForTest(schema._def.right),
      };
    }
    if (schema instanceof z.ZodUnion) {
      return {
        options: schema._def.options.map(serializeSchemaForTest)
      };
    }
    if (schema instanceof z.ZodObject) {
      return {
        shape: Object.keys(schema.shape).reduce((carry, key) => ({
          ...carry,
          [key]: serializeSchemaForTest(schema.shape[key])
        }), {})
      };
    }
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
      return {
        value: serializeSchemaForTest(schema.unwrap())
      };
    }
    if (schema instanceof z.ZodEffects || schema instanceof z.ZodTransformer) {
      return {
        value: serializeSchemaForTest(schema._def.schema)
      };
    }
    if (schema instanceof z.ZodRecord) {
      return {
        values: serializeSchemaForTest(schema._def.valueType)
      };
    }
    if (schema instanceof z.ZodArray) {
      return {
        items: serializeSchemaForTest(schema._def.type)
      };
    }
    if (schema instanceof z.ZodLiteral) {
      return {
        value: schema._def.value
      };
    }
  };
  return {
    _type: schema._def.typeName,
    ...getDescription()
  };
};
