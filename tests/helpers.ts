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
  return {
    _type: schema._def.typeName,
    ...(
      schema instanceof z.ZodIntersection ? {
        left: serializeSchemaForTest(schema._def.left),
        right: serializeSchemaForTest(schema._def.right),
      } : schema instanceof z.ZodUnion ? {
        options: schema._def.options.map(serializeSchemaForTest)
      } : schema instanceof z.ZodObject ? {
        shape: Object.keys(schema.shape).reduce((carry, key) => ({
          ...carry,
          [key]: serializeSchemaForTest(schema.shape[key])
        }), {})
      } : schema instanceof z.ZodOptional || schema instanceof z.ZodNullable ? {
        value: serializeSchemaForTest(schema.unwrap())
      } : schema instanceof z.ZodEffects || schema instanceof z.ZodTransformer ? {
        value: serializeSchemaForTest(schema._def.schema)
      } : schema instanceof z.ZodRecord ? {
        values: serializeSchemaForTest(schema._def.valueType)
      } : schema instanceof z.ZodArray ? {
        items: serializeSchemaForTest(schema._def.type)
      } : schema instanceof z.ZodLiteral ? {
        value: schema._def.value
      } : {}
    )
  };
};
