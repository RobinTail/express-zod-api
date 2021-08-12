import {Request} from 'express';
import {HttpError} from 'http-errors';
import {getType} from 'mime';
import {z} from 'zod';
import {LoggerConfig, loggerLevels} from './config-type';
import {MiddlewareDefinition} from './middleware';

export type FlatObject = Record<string, any>;

type ObjectSchema = z.AnyZodObject;
type Extractable = 'shape' | '_unknownKeys' | '_catchall' | '_output' | '_input';
type UnionSchema = z.ZodUnion<[ObjectSchema, ...ObjectSchema[]]>;
type IntersectionSchema = z.ZodIntersection<ObjectSchema, ObjectSchema>;

export type IOSchema = ObjectSchema | UnionSchema | IntersectionSchema;

export type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer K)[] ? K : never;

type UnionResult<T extends ObjectSchema[], F extends Extractable> = ArrayElement<T>[F];
type IntersectionResult<T extends IntersectionSchema, F extends Extractable> =
  T['_def']['left'][F] & T['_def']['right'][F];

type IOExtract<T extends IOSchema | any, F extends Extractable> =
  T extends ObjectSchema ? T[F] :
  T extends UnionSchema ? UnionResult<T['options'], F> :
  T extends IntersectionSchema ? IntersectionResult<T, F> : unknown;

export type Merge<A extends IOSchema, B extends IOSchema | any> = z.ZodObject<
  IOExtract<A, 'shape'> & IOExtract<B, 'shape'>,
  IOExtract<A, '_unknownKeys'>,
  IOExtract<A, '_catchall'>,
  IOExtract<A, '_output'> & IOExtract<B, '_output'>,
  IOExtract<A, '_input'> & IOExtract<B, '_input'>
>;

export type OutputMarker = IOSchema & {_typeGuard: 'OutputMarker'};
export const markOutput = (output: IOSchema) => output as OutputMarker;

export type ReplaceMarkerInShape<S extends z.ZodRawShape, OUT extends IOSchema> = {
  [K in keyof S]: S[K] extends OutputMarker
    ? OUT
    : S[K]
}

export function extractObjectSchema(subject: IOSchema): ObjectSchema {
  if (subject instanceof z.ZodUnion) {
    return subject.options.reduce((acc, option) =>
      acc.partial().merge(option.partial()));
  }
  if (subject instanceof z.ZodIntersection) {
    return subject._def.left.merge(subject._def.right);
  }
  return subject;
}

export function combineEndpointAndMiddlewareInputSchemas<IN extends IOSchema, mIN>(
  input: IN,
  middlewares: MiddlewareDefinition<IOSchema, any, any>[]
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

export function getMessageFromError(error: Error): string {
  return error instanceof z.ZodError
    ? error.issues.map(({path, message}) =>
      `${path.join('/')}: ${message}`).join('; ')
    : error.message;
}

export function getStatusCodeFromError(error: Error): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }
  if (error instanceof z.ZodError) {
    return 400;
  }
  return 500;
}

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  mimeTypes: string[];
};

export const createApiResponse = <S extends z.ZodTypeAny>(schema: S, mimeTypes: string | string[] = getType('json') as string) => {
  return {
    schema,
    mimeTypes: typeof mimeTypes === 'string' ? [mimeTypes] : mimeTypes,
  } as ApiResponse<S>;
};
