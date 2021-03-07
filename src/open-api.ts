import {
  MediaTypeObject,
  OpenApiBuilder,
  OperationObject,
  ParameterObject,
  PathsObject,
  SchemaObject
} from 'openapi3-ts';
import {PathItemObject} from 'openapi3-ts/src/model/OpenApi';
import {ZodTypeAny} from 'zod';
import {AnyZodObject} from 'zod/lib/cjs/types/object';
import {ZodTransformerDef} from 'zod/lib/cjs/types/transformer';
import {Routing, routingCycle} from './routing';
import {lookup} from 'mime';

const getOpenApiPropertyType = (value: ZodTypeAny): Partial<SchemaObject> => {
  const otherProps: Partial<SchemaObject> = {
    nullable: value.isNullable(),
  };
  switch (value._def.t) {
    case 'string':
      return {...otherProps, type: 'string'};
    case 'number':
      return {...otherProps, type: 'number'};
    case 'bigint':
      return {...otherProps, type: 'integer'};
    case 'boolean':
      return {...otherProps, type: 'boolean'};
    case 'date':
      return {...otherProps, type: 'string', format: 'date'};
    case 'null':
      return {...otherProps, type: 'null'};
    case 'array':
      return {...otherProps, type: 'array'};
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

export const generateOpenApi = ({
  routing, title, version, serverUrl,
  successfulResponseDescription
}: GenerationParams): OpenApiBuilder => {
  const openApiVersion = '3.0.0';
  const mimeJson = lookup('.json');
  const paths: PathsObject = {};
  routingCycle(routing, (endpoint, fullPath, method) => {
    const body: MediaTypeObject = {
      schema: getOpenApiPropertyType(endpoint.getInputSchema())
    };
    const response: MediaTypeObject = {
      schema: getOpenApiPropertyType(endpoint.getOutputSchema())
    };
    const operation: OperationObject = {
      responses: {
        default: {
          description: successfulResponseDescription || 'Successful response',
          content: {
            [mimeJson]: response
          }
        },
      }
    };
    if (method === 'get') {
      operation.parameters = Object.keys(endpoint.getInputSchema().shape).map((name): ParameterObject => ({
        name,
        in: 'query',
        required: !endpoint.getInputSchema().shape[name].isOptional(),
        schema: getOpenApiPropertyType(endpoint.getInputSchema().shape[name])
      }));
    } else {
      operation.requestBody = {
        content: {
          [mimeJson]: body
        }
      };
    }
    if (!paths[fullPath]) {
      paths[fullPath] = {} as PathItemObject;
    }
    paths[fullPath] = {
      ...paths[fullPath],
      [method]: operation
    };
  });
  const builder = OpenApiBuilder
    .create()
    .addVersion(openApiVersion)
    .addInfo({title, version})
    .addServer({url: serverUrl});
  Object.keys(paths).forEach((path) => builder.addPath(path, paths[path]));
  return builder;
};
