import {
  OpenApiBuilder,
  OperationObject,
  ParameterObject,
  SchemaObject,
  ContentObject
} from 'openapi3-ts';
import {z} from 'zod';
import {OpenAPIError} from './errors';
import {ZodFile} from './file-schema';
import {ArrayElement, extractObjectSchema} from './helpers';
import {Routing, routingCycle, RoutingCycleParams} from './routing';
import {lookup} from 'mime';

const describeSchema = (value: z.ZodTypeAny, isResponse: boolean): SchemaObject => {
  const otherProps: SchemaObject = {};
  if (value.isNullable()) {
    otherProps.nullable = true;
  }
  switch (true) {
    case value instanceof z.ZodString:
      return {
        ...otherProps,
        ...describeString(value as z.ZodString),
      };
    case value instanceof z.ZodNumber:
      return {
        ...otherProps,
        ...describeNumber(value as z.ZodNumber)
      };
    case value instanceof z.ZodBigInt:
      return {...otherProps, type: 'integer', format: 'bigint'};
    case value instanceof z.ZodBoolean:
      return {...otherProps, type: 'boolean'};
    case value instanceof z.ZodDate:
      return {...otherProps, type: 'string', format: 'date'};
    case value instanceof z.ZodNull:
      // null is not supported https://swagger.io/docs/specification/data-models/data-types/
      return {...otherProps, type: 'string', nullable: true, format: 'null'};
    case value instanceof z.ZodArray:
      return {
        ...otherProps,
        ...describeArray(value._def as z.ZodArrayDef, isResponse)
      };
    case value instanceof z.ZodTuple:
      return {
        ...otherProps,
        ...describeTuple(value as z.ZodTuple, isResponse)
      };
    case value instanceof z.ZodRecord:
      return {
        ...otherProps,
        type: 'object',
        additionalProperties: describeSchema((value as z.ZodRecord)._def.valueType, isResponse)
      };
    case value instanceof z.ZodObject:
      return {
        ...otherProps,
        type: 'object',
        properties: describeObjectProperties(value as z.AnyZodObject, isResponse),
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
    case value instanceof ZodFile:
      return {
        ...otherProps,
        type: 'string',
        format: (value as ZodFile).isBinary ? 'binary' :
          (value as ZodFile).isBase64 ? 'byte' : 'file'
      };
    case value instanceof z.ZodAny:
      return {
        ...otherProps,
        format: 'any'
      };
    case value instanceof z.ZodUndefined:
    case value instanceof z.ZodMap:
    case value instanceof z.ZodFunction:
    case value instanceof z.ZodLazy:
    case value instanceof z.ZodPromise:
    case value instanceof z.ZodUnknown:
    case value instanceof z.ZodNever:
    case value instanceof z.ZodVoid:
    default:
      throw new OpenAPIError(`Zod type ${value.constructor.name} is unsupported`);
  }
};

const describeArray = (definition: z.ZodArrayDef, isResponse: boolean): SchemaObject => ({
  type: 'array',
  items: describeSchema(definition.type, isResponse),
  ...(definition.minLength ? { minItems: definition.minLength.value } : {}),
  ...(definition.maxLength ? { maxItems: definition.maxLength?.value } : {})
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
const describeTuple = (schema: z.ZodTuple, isResponse: boolean): SchemaObject => {
  const types = schema.items.map((item) => describeSchema(item, isResponse));
  return {
    type: 'array',
    minItems: types.length,
    maxItems: types.length,
    items: {
      oneOf: types,
      format: 'tuple',
      ...(types.length === 0 ? {} : {
        description: types.map((schema, index) => `${index}: ${schema.type}`).join(', ')
      })
    }
  };
};

const describeString = (schema: z.ZodString): SchemaObject => {
  const checks = schema._def.checks;
  const isEmail = checks.find(({kind}) => kind === 'email') !== undefined;
  const isUrl = checks.find(({kind}) => kind === 'url') !== undefined;
  const isUUID = checks.find(({kind}) => kind === 'uuid') !== undefined;
  const minLengthCheck = checks.find(
    ({kind}) => kind === 'min'
  ) as Extract<ArrayElement<z.ZodStringDef['checks']>, {kind: 'min'}> | undefined;
  const maxLengthCheck = checks.find(
    ({kind}) => kind === 'max'
  ) as Extract<ArrayElement<z.ZodStringDef['checks']>, {kind: 'max'}> | undefined;
  const regexCheck = checks.find(
    ({kind}) => kind === 'regex'
  ) as Extract<ArrayElement<z.ZodStringDef['checks']>, {kind: 'regex'}> | undefined;
  return {
    type: 'string' as const,
    ...(isEmail ? { format: 'email' as const } : {}),
    ...(isUrl ? { format: 'url' as const } : {}),
    ...(isUUID ? { format: 'uuid' as const } : {}),
    ...(minLengthCheck ? { minLength: minLengthCheck.value } : {}),
    ...(maxLengthCheck ? { maxLength: maxLengthCheck.value } : {}),
    ...(regexCheck ? { pattern: `/${regexCheck.regex.source}/${regexCheck.regex.flags}` } : {})
  };
};

const describeNumber = (schema: z.ZodNumber): SchemaObject => {
  const minCheck = schema._def.checks.find(
    ({kind}) => kind === 'min'
  ) as Extract<ArrayElement<z.ZodNumberDef['checks']>, {kind: 'min'}> | undefined;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = schema._def.checks.find(
    ({kind}) => kind === 'max'
  ) as Extract<ArrayElement<z.ZodNumberDef['checks']>, {kind: 'max'}> | undefined;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  return {
    type: schema.isInt ? 'integer' as const : 'number' as const,
    format: schema.isInt ? 'int64' as const : 'double' as const,
    minimum: schema.minValue === null ?
      (schema.isInt ? Number.MIN_SAFE_INTEGER : Number.MIN_VALUE) : schema.minValue,
    exclusiveMinimum: !isMinInclusive,
    maximum: schema.maxValue === null ?
      (schema.isInt ? Number.MAX_SAFE_INTEGER : Number.MAX_VALUE) : schema.maxValue,
    exclusiveMaximum: !isMaxInclusive
  };
};

const describeObjectProperties = (schema: z.AnyZodObject, isResponse: boolean): Record<string, SchemaObject> => {
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
            description: `${method.toUpperCase()} ${fullPath} ${successfulResponseDescription}`,
            content: endpoint.getPositiveMimeTypes().reduce((carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: describeSchema(endpoint.getPositiveResponseSchema(), true)
              }
            }), {} as ContentObject),
          },
          '400': {
            description: `${method.toUpperCase()} ${fullPath} ${errorResponseDescription}`,
            content: endpoint.getNegativeMimeTypes().reduce((carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: describeSchema(endpoint.getNegativeResponseSchema(), true)
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
