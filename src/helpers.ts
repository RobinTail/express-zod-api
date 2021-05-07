import {Request} from 'express';
import {z} from 'zod';
import {LoggerConfig, loggerLevels} from './config-type';
import {MiddlewareDefinition} from './middleware';

export type FlatObject = Record<string, any>;
type EmptyFlatObject = {[K in never]: never};

type ObjectSchema = z.AnyZodObject;
type ObjectUnionSchema = z.ZodUnion<[ObjectSchema, ...ObjectSchema[]]>;
type ObjectIntersectionSchema = z.ZodIntersection<ObjectSchema, ObjectSchema>;
export type IOSubject = ObjectSchema | ObjectUnionSchema | ObjectIntersectionSchema;

export function getObject(subject: IOSubject): ObjectSchema {
  if (subject instanceof z.ZodUnion) {
    return subject.options.reduce((acc, opt) =>
      acc.partial().merge(opt.partial()));
  }
  if (subject instanceof z.ZodIntersection) {
    return subject._def.left.merge(subject._def.right);
  }
  return subject;
}

type ToFetch = 'shape' | '_unknownKeys' | '_catchall';
type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
type UnionObjectSchemas<T extends ObjectSchema[], F extends ToFetch> = Partial<ArrayElement<T>[F]>;

type FetchIO<T extends IOSubject | any, F extends ToFetch> =
  T extends ObjectSchema ? T[F] :
  T extends ObjectUnionSchema ? UnionObjectSchemas<T['options'], F> :
  T extends ObjectIntersectionSchema ? T['_def']['left'][F] & T['_def']['right'][F] :
    EmptyFlatObject;

export type Merge<A extends IOSubject, B extends IOSubject | any> = z.ZodObject<
  FetchIO<A, 'shape'> & FetchIO<B, 'shape'>,
  FetchIO<A, '_unknownKeys'>,
  FetchIO<A, '_catchall'>
>;

export function combineEndpointAndMiddlewareInputSchemas<IN extends IOSubject, mIN>(
  input: IN,
  middlewares: MiddlewareDefinition<any, any, any>[]
): Merge<IN, mIN> {
  if (middlewares.length === 0) {
    return input as any as Merge<IN, mIN>;
  }
  const mSchema: IOSubject = middlewares
    .map((middleware) => middleware.input)
    .reduce((carry: IOSubject, schema: IOSubject) => getObject(carry).merge(getObject(schema)));
  return getObject(mSchema).merge(getObject(input)) as Merge<IN, mIN>;
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
