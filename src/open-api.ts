import {
  OpenApiBuilder,
  OperationObject,
  SchemaObject
} from 'openapi3-ts';
import {ReferenceObject} from 'openapi3-ts/src/model/OpenApi';
import {
  ZodAny, ZodArray, ZodBigInt, ZodBoolean, ZodDate, ZodEffects,
  ZodEnum, ZodFunction, ZodIntersection, ZodLazy, ZodLiteral,
  ZodMap, ZodNativeEnum, ZodNever, ZodNull, ZodNullable, ZodString,
  ZodNumber, ZodObject, ZodOptional, ZodPromise, ZodRecord,
  ZodTransformer, ZodTuple, ZodTypeAny, ZodUndefined, ZodUnion,
  ZodUnknown, ZodVoid, ZodArrayDef, AnyZodObject, ZodEffectsDef
} from 'zod';
import {Routing, routingCycle} from './routing';
import {lookup} from 'mime';

const _usedRef: Record<string, true> = {};

const getOpenApiPropertyType = (value: ZodTypeAny): Partial<SchemaObject> => {
  const otherProps: Partial<SchemaObject> = {};
  if (value.isNullable()) {
    otherProps.nullable = true;
  }
  switch (true) {
    case value instanceof ZodString:
      return {...otherProps, type: 'string'};
    case value instanceof ZodNumber:
      return {...otherProps, type: 'number'};
    case value instanceof ZodBigInt:
      return {...otherProps, type: 'integer', format: 'int64'};
    case value instanceof ZodBoolean:
      return {...otherProps, type: 'boolean'};
    case value instanceof ZodDate:
      return {...otherProps, type: 'string', format: 'date'};
    case value instanceof ZodNull:
      // null is not supported https://swagger.io/docs/specification/data-models/data-types/
      // return {...otherProps, type: 'null'};
      return {...otherProps, type: 'string', nullable: true, format: 'null'};
    case value instanceof ZodArray:
      return {
        ...otherProps,
        type: 'array',
        items: getOpenApiPropertyType((value._def as ZodArrayDef).type)
      };
    case value instanceof ZodObject:
    case value instanceof ZodRecord:
      return {
        ...otherProps,
        type: 'object',
        properties: objectCycle(value as AnyZodObject),
        required: Object.keys((value as AnyZodObject).shape)
          .filter((key) => !(value as AnyZodObject).shape[key].isOptional())
      };
    case value instanceof ZodLiteral:
      return {
        ...otherProps,
        type: typeof value._def.value as 'string' | 'number' | 'boolean',
        enum: [value._def.value]
      };
    case value instanceof ZodEnum:
    case value instanceof ZodNativeEnum:
      return {
        ...otherProps,
        type: typeof Object.values(value._def.values)[0] as 'string' | 'number',
        enum: Object.values(value._def.values)
      };
    case value instanceof ZodTransformer:
    case value instanceof ZodEffects:
      return {
        ...otherProps,
        ...getOpenApiPropertyType((value._def as ZodEffectsDef).schema)
      };
    case value instanceof ZodUndefined:
    case value instanceof ZodUnion:
    case value instanceof ZodIntersection:
    case value instanceof ZodTuple:
    case value instanceof ZodMap:
    case value instanceof ZodFunction:
    case value instanceof ZodLazy:
    case value instanceof ZodPromise:
    case value instanceof ZodAny:
    case value instanceof ZodUnknown:
    case value instanceof ZodNever:
    case value instanceof ZodVoid:
    case value instanceof ZodOptional:
    case value instanceof ZodNullable:
    default:
      throw new Error(`Zod type ${value.constructor.name} is unsupported`);
  }
};

const objectCycle = (schema: AnyZodObject): Record<string, SchemaObject> => {
  return Object.keys(schema.shape).reduce((carry, key) => ({
    ...carry,
    [key]: getOpenApiPropertyType(schema.shape[key])
  }), {} as Record<string, SchemaObject>);
};

interface GenerationParams {
  title: string;
  version: string;
  serverUrl: string;
  routing: Routing;
  successfulResponseDescription?: string
}

interface Ref {
  name: string;
  link: {$ref: string};
}

const createRef = (str: string, section = 'schemas'): Ref => {
  const name = str.replace(/[^A-Za-z0-9\-._]/g, '');
  let n = 1;
  while (_usedRef[`${name}${n}`]) {
    n++;
  }
  const ref = `${name}${n}`;
  _usedRef[ref] = true;
  return {
    name: ref,
    link: {$ref: `#/components/${section}/${ref}`}
  };
};

export const generateOpenApi = ({
  routing, title, version, serverUrl,
  successfulResponseDescription
}: GenerationParams): OpenApiBuilder => {
  const openApiVersion = '3.0.0';
  const mimeJson = lookup('.json');
  const builder = OpenApiBuilder
    .create()
    .addVersion(openApiVersion)
    .addInfo({title, version})
    .addServer({url: serverUrl});
  routingCycle(routing, (endpoint, fullPath, method) => {
    const responseSchemaRef = createRef('responseSchema');
    builder.addSchema(responseSchemaRef.name, {
      ...getOpenApiPropertyType(endpoint.getOutputSchema()),
      description: `${fullPath} ${method.toUpperCase()} response schema`
    });
    const operation: OperationObject = {
      responses: {
        default: {
          description: successfulResponseDescription || 'Successful response',
          content: {
            [mimeJson]: {
              schema: responseSchemaRef.link
            }
          }
        },
      }
    };
    if (method === 'get') {
      operation.parameters = [];
      Object.keys(endpoint.getInputSchema().shape).forEach((name) => {
        const parameterRef = createRef('parameter', 'parameters');
        builder.addParameter(parameterRef.name, {
          name,
          in: 'query',
          required: !endpoint.getInputSchema().shape[name].isOptional(),
          schema: {
            ...getOpenApiPropertyType(endpoint.getInputSchema().shape[name]),
            description: `${fullPath} ${method.toUpperCase()} parameter`
          },
        });
        (operation.parameters as ReferenceObject[]).push(parameterRef.link);
      });
    } else {
      const bodySchemaRef = createRef('requestBody');
      builder.addSchema(bodySchemaRef.name, {
        ...getOpenApiPropertyType(endpoint.getInputSchema()),
        description: `${fullPath} ${method.toUpperCase()} request body`
      });
      operation.requestBody = {
        content: {
          [mimeJson]: {
            schema: bodySchemaRef.link
          }
        }
      };
    }
    builder.addPath(fullPath, {
      ...(builder.rootDoc.paths?.[fullPath] || {}),
      [method]: operation
    });
  });
  return builder;
};
