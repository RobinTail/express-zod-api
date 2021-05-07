import {
  OpenApiBuilder,
  OperationObject,
  SchemaObject
} from 'openapi3-ts';
import {ReferenceObject} from 'openapi3-ts/src/model/OpenApi';
import {z} from 'zod';
import {getObject} from './helpers';
import {Routing, routingCycle} from './routing';
import {lookup} from 'mime';

const getOpenApiPropertyType = (value: z.ZodTypeAny): Partial<SchemaObject> => {
  const otherProps: Partial<SchemaObject> = {};
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
        items: getOpenApiPropertyType((value._def as z.ZodArrayDef).type)
      };
    case value instanceof z.ZodObject:
    case value instanceof z.ZodRecord:
      return {
        ...otherProps,
        type: 'object',
        properties: objectCycle(value as z.AnyZodObject),
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
        ...getOpenApiPropertyType((value._def as z.ZodEffectsDef).schema)
      };
    case value instanceof z.ZodOptional:
    case value instanceof z.ZodNullable:
      return {
        ...otherProps,
        ...getOpenApiPropertyType((value as z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>).unwrap())
      };
    case value instanceof z.ZodIntersection:
      return {
        ...otherProps,
        allOf: [
          getOpenApiPropertyType((value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.left),
          getOpenApiPropertyType((value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.right)
        ]
      };
    case value instanceof z.ZodUnion:
      return {
        ...otherProps,
        oneOf: (value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>)._def.options.map(getOpenApiPropertyType)
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
      throw new Error(`Zod type ${value.constructor.name} is unsupported`);
  }
};

const objectCycle = (schema: z.AnyZodObject): Record<string, SchemaObject> => {
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

export class OpenAPI {
  private _usedRef: Record<string, true> = {};
  public builder: OpenApiBuilder; // @todo extend builder after switching to ES6 target

  private createRef(str: string, section = 'schemas'): Ref {
    const name = str.replace(/[^A-Za-z0-9\-._]/g, '');
    let n = 1;
    while (this._usedRef[`${name}${n}`]) {
      n++;
    }
    const ref = `${name}${n}`;
    this._usedRef[ref] = true;
    return {
      name: ref,
      link: {$ref: `#/components/${section}/${ref}`}
    };
  }

  public constructor({routing, title, version, serverUrl, successfulResponseDescription}: GenerationParams) {
    const mimeJson = lookup('.json');
    this.builder = new OpenApiBuilder()
      .addInfo({title, version})
      .addServer({url: serverUrl});
    routingCycle(routing, (endpoint, fullPath, method) => {
      const responseSchemaRef = this.createRef('responseSchema');
      this.builder.addSchema(responseSchemaRef.name, {
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
        const subject = getObject(endpoint.getInputSchema()).shape;
        Object.keys(subject).forEach((name) => {
          const parameterRef = this.createRef('parameter', 'parameters');
          this.builder.addParameter(parameterRef.name, {
            name,
            in: 'query',
            required: !subject[name].isOptional(),
            schema: {
              ...getOpenApiPropertyType(subject[name]),
              description: `${fullPath} ${method.toUpperCase()} parameter`
            },
          });
          (operation.parameters as ReferenceObject[]).push(parameterRef.link);
        });
      } else {
        const bodySchemaRef = this.createRef('requestBody');
        this.builder.addSchema(bodySchemaRef.name, {
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
      this.builder.addPath(fullPath, {
        ...(this.builder.rootDoc.paths?.[fullPath] || {}),
        [method]: operation
      });
    });
  }
}
