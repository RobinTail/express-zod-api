import {Request} from 'express';
import {z} from 'zod';
import {LoggerConfig, loggerLevels} from './config-type';
import {MiddlewareDefinition} from './middleware';

export type FlatObject = Record<string, any>;
type EmptyFlatObject = {[K in never]: never};

type ObjectSchema = z.AnyZodObject;
type Extractable = 'shape' | '_unknownKeys' | '_catchall';
type UnionSchema = z.ZodUnion<[ObjectSchema, ...ObjectSchema[]]>;
type IntersectionSchema = z.ZodIntersection<ObjectSchema, ObjectSchema>;

export type IO = ObjectSchema | UnionSchema | IntersectionSchema;

type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer K)[] ? K : never;

type UnionResult<T extends ObjectSchema[], F extends Extractable> = Partial<ArrayElement<T>[F]>;
type IntersectionResult<T extends IntersectionSchema, F extends Extractable> =
  T['_def']['left'][F] & T['_def']['right'][F];

type IOExtract<T extends IO | any, F extends Extractable> =
  T extends ObjectSchema ? T[F] :
  T extends UnionSchema ? UnionResult<T['options'], F> :
  T extends IntersectionSchema ? IntersectionResult<T, F> : EmptyFlatObject;

export type Merge<A extends IO, B extends IO | any> = z.ZodObject<
  IOExtract<A, 'shape'> & IOExtract<B, 'shape'>,
  IOExtract<A, '_unknownKeys'>,
  IOExtract<A, '_catchall'>
>;

export function extractObjectSchema(subject: IO): ObjectSchema {
  if (subject instanceof z.ZodUnion) {
    return subject.options.reduce((acc, option) =>
      acc.partial().merge(option.partial()));
  }
  if (subject instanceof z.ZodIntersection) {
    return subject._def.left.merge(subject._def.right);
  }
  return subject;
}

export function combineEndpointAndMiddlewareInputSchemas<IN extends IO, mIN>(
  input: IN,
  middlewares: MiddlewareDefinition<IO, any, any>[]
): Merge<IN, mIN> {
  if (middlewares.length === 0) {
    return extractObjectSchema(input) as Merge<IN, mIN>;
  }
  const mSchema = middlewares
    .map((middleware) => middleware.input)
    .reduce((carry, schema) =>
      extractObjectSchema(carry).merge(extractObjectSchema(schema))
    );
  return extractObjectSchema(mSchema).merge(extractObjectSchema(input)) as Merge<IN, mIN>;
}

export function getInitialInput(request: Request): any {
  switch (request.method) {
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return request.body;
    case 'GET':
      return request.query;
    case 'DELETE': // _may_ have body
    default:
      return {...request.query, ...request.body};
  }
}

export function isLoggerConfig(logger: any): logger is LoggerConfig {
  return typeof logger === 'object' &&
    'level' in logger && 'color' in logger &&
    Object.keys(loggerLevels).includes(logger.level) &&
    typeof logger.color === 'boolean';
}
