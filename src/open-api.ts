import {
  OpenApiBuilder,
  OperationObject,
  ParameterObject,
  SchemaObject,
  ContentObject
} from 'openapi3-ts';
import {z} from 'zod';
import {OpenAPIError} from './errors';
import {extractObjectSchema} from './helpers';
import {Routing, routingCycle, RoutingCycleParams} from './routing';
import {lookup} from 'mime';

const describeSchema = (value: z.ZodTypeAny, isResponse: boolean): SchemaObject => {
  const otherProps: SchemaObject = {};
  if (value.isNullable()) {
    otherProps.nullable = true;
  }
  switch (true) {
    case value instanceof z.ZodString:
      return {...otherProps, type: 'string'};
    case value instanceof z.ZodNumber:
      return {...otherProps, type: 'number'};
    case value instanceof z.ZodBigInt:
      return {...otherProps, type: 'integer', format: 'int64'};
    case value instanceof z.ZodBoolean:
      return {...otherProps, type: 'boolean'};
    case value instanceof z.ZodDate:
      return {...otherProps, type: 'string', format: 'date'};
    case value instanceof z.ZodNull:
      // null is not supported https://swagger.io/docs/specification/data-models/data-types/
      // return {...otherProps, type: 'null'};
      return {...otherProps, type: 'string', nullable: true, format: 'null'};
    case value instanceof z.ZodArray:
      return {
        ...otherProps,
        type: 'array',
        items: describeSchema((value._def as z.ZodArrayDef).type, isResponse)
      };
    case value instanceof z.ZodObject:
    case value instanceof z.ZodRecord:
      return {
        ...otherProps,
        type: 'object',
        properties: describeObject(value as z.AnyZodObject, isResponse),
        required: Object.keys((value as z.AnyZodObject).shape)
          .filter((key) => !(value as z.AnyZodObject).shape[key].isOptional())
      };
    case value instanceof z.ZodLiteral:
      return {
        ...otherProps,
        type: typeof value._def.value as 'string' | 'number' | 'boolean',
        enum: [value._def.value]
      };
    case value instanceof z.ZodEnum:
    case value instanceof z.ZodNativeEnum:
      return {
        ...otherProps,
        type: typeof Object.values(value._def.values)[0] as 'string' | 'number',
        enum: Object.values(value._def.values)
      };
    case value instanceof z.ZodTransformer:
    case value instanceof z.ZodEffects:
      return {
        ...otherProps,
        ...describeTransformation(value as z.ZodEffects<any> | z.ZodTransformer<any>, isResponse)
      };
    case value instanceof z.ZodOptional:
    case value instanceof z.ZodNullable:
      return {
        ...otherProps,
        ...describeSchema((value as z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>).unwrap(), isResponse)
      };
    case value instanceof z.ZodIntersection:
      return {
        ...otherProps,
        allOf: [
          describeSchema((value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.left, isResponse),
          describeSchema((value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.right, isResponse)
        ]
      };
    case value instanceof z.ZodUnion:
      return {
        ...otherProps,
        oneOf: (value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>)._def.options
          .map((schema) => describeSchema(schema, isResponse))
      };
    case value instanceof z.ZodUndefined:
    case value instanceof z.ZodTuple:
    case value instanceof z.ZodMap:
    case value instanceof z.ZodFunction:
    case value instanceof z.ZodLazy:
    case value instanceof z.ZodPromise:
    case value instanceof z.ZodAny:
    case value instanceof z.ZodUnknown:
    case value instanceof z.ZodNever:
    case value instanceof z.ZodVoid:
    default:
      throw new OpenAPIError(`Zod type ${value.constructor.name} is unsupported`);
  }
};

const describeObject = (schema: z.AnyZodObject, isResponse: boolean): Record<string, SchemaObject> => {
  return Object.keys(schema.shape).reduce((carry, key) => ({
    ...carry,
    [key]: describeSchema(schema.shape[key], isResponse)
  }), {} as Record<string, SchemaObject>);
};

const describeTransformation = (value: z.ZodTransformer<any> | z.ZodEffects<any>, isResponse: boolean) => {
  const input = describeSchema(value._def.schema, isResponse);
  let output = 'undefined';
  if (isResponse && value._def.effects && value._def.effects.length > 0) {
    const effect = value._def.effects.filter((ef) => ef.type === 'transform').slice(-1)[0];
    if (effect && 'transform' in effect) {
      try {
        output = typeof effect.transform(
          ['integer', 'number'].includes(`${input.type}`) ? 0 :
            'string' === input.type ? '' :
              'boolean' === input.type ? false :
                'object' === input.type ? {} :
                  'null' === input.type ? null :
                    'array' === input.type ? [] : undefined
        );
      } catch (e) {/**/}
    }
  }
  return {
    ...input,
    ...(
      ['number', 'string', 'boolean', 'null'].includes(output) ? {
        type: output as 'number' | 'string' | 'boolean' | 'null'
      } : {}
    )
  };
};

interface GenerationParams {
  title: string;
  version: string;
  serverUrl: string;
  routing: Routing;
  successfulResponseDescription?: string;
  errorResponseDescription?: string;
}

const mimeJson = lookup('json');

export class OpenAPI extends OpenApiBuilder {
  public constructor({
    routing, title, version, serverUrl,
    successfulResponseDescription = 'Successful response',
    errorResponseDescription = 'Error response'
  }: GenerationParams) {
    super();
    this.addInfo({title, version}).addServer({url: serverUrl});
    const cb: RoutingCycleParams['cb'] = (endpoint, fullPath, method) => {
      const operation: OperationObject = {
        responses: {
          '200': {
            description: successfulResponseDescription,
            content: endpoint.getPositiveMimeTypes().reduce((carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: {
                  ...describeSchema(endpoint.getPositiveResponseSchema(), true),
                  description: `${method.toUpperCase()} ${fullPath} ${successfulResponseDescription}`
                }
              }
            }), {} as ContentObject),
          },
          '400': {
            description: errorResponseDescription,
            content: endpoint.getNegativeMimeTypes().reduce((carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: {
                  ...describeSchema(endpoint.getNegativeResponseSchema(), true),
                  description: `${method.toUpperCase()} ${fullPath} ${errorResponseDescription}`
                }
              }
            }), {} as ContentObject),
          }
        }
      };
      if (endpoint.getDescription()) {
        operation.description = endpoint.getDescription();
      }
      if (method === 'get') {
        operation.parameters = [];
        const subject = extractObjectSchema(endpoint.getInputSchema()).shape;
        Object.keys(subject).forEach((name) => {
          (operation.parameters as ParameterObject[]).push({
            name,
            in: 'query',
            required: !subject[name].isOptional(),
            schema: {
              ...describeSchema(subject[name], false),
              description: `${method.toUpperCase()} ${fullPath} parameter`
            },
          });
        });
      } else {
        operation.requestBody = {
          content: {
            [mimeJson]: {
              schema: {
                ...describeSchema(endpoint.getInputSchema(), false),
                description: `${method.toUpperCase()} ${fullPath} request body`
              }
            }
          }
        };
      }
      this.addPath(fullPath, {
        ...(this.rootDoc.paths?.[fullPath] || {}),
        [method]: operation,
      });
    };
    routingCycle({routing, cb});
  }
}
