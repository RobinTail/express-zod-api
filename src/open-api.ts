import {
  OpenApiBuilder,
  OperationObject,
  SchemaObject
} from 'openapi3-ts';
import {ReferenceObject} from 'openapi3-ts/src/model/OpenApi';
import {ZodTypeAny} from 'zod';
import {ZodArrayDef} from 'zod/lib/cjs/types/array';
import {AnyZodObject} from 'zod/lib/cjs/types/object';
import {ZodTransformerDef} from 'zod/lib/cjs/types/transformer';
import {Routing, routingCycle} from './routing';
import {lookup} from 'mime';

const _usedRef: Record<string, true> = {};

const getOpenApiPropertyType = (value: ZodTypeAny): Partial<SchemaObject> => {
  const otherProps: Partial<SchemaObject> = {};
  if (value.isNullable()) {
    otherProps.nullable = true;
  }
  switch (value._def.t) {
    case 'string':
      return {...otherProps, type: 'string'};
    case 'number':
      return {...otherProps, type: 'number'};
    case 'bigint':
      return {...otherProps, type: 'integer', format: 'int64'};
    case 'boolean':
      return {...otherProps, type: 'boolean'};
    case 'date':
      return {...otherProps, type: 'string', format: 'date'};
    case 'null':
      // null is not supported https://swagger.io/docs/specification/data-models/data-types/
      // return {...otherProps, type: 'null'};
      return {...otherProps, type: 'string', nullable: true, format: 'null'};
    case 'array':
      return {
        ...otherProps,
        type: 'array',
        items: getOpenApiPropertyType((value._def as ZodArrayDef).type)
      };
    case 'object':
    case 'record':
      return {
        ...otherProps,
        type: 'object',
        properties: objectCycle(value as AnyZodObject),
        required: Object.keys((value as AnyZodObject).shape)
          .filter((key) => !(value as AnyZodObject).shape[key].isOptional())
      };
    case 'literal':
      return {
        ...otherProps,
        type: typeof value._def.value as 'string' | 'number' | 'boolean',
        enum: [value._def.value]
      };
    case 'enum':
    case 'nativeEnum':
      return {
        ...otherProps,
        type: typeof Object.values(value._def.values)[0] as 'string' | 'number',
        enum: Object.values(value._def.values)
      };
    case 'transformer':
      return {
        ...otherProps,
        ...getOpenApiPropertyType((value._def as ZodTransformerDef).schema)
      };
    case 'undefined':
    case 'union':
    case 'intersection':
    case 'tuple':
    case 'map':
    case 'function':
    case 'lazy':
    case 'promise':
    case 'any':
    case 'unknown':
    case 'never':
    case 'void':
    case 'optional':
    case 'nullable':
    default:
      throw new Error(`Zod type ${value._def.t} is unsupported`);
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
