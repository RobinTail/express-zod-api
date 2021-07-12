# Changelog

## Version 2

While v2 is beta some methods and properties might be renamed or changed without backward compatibility.

### v2.0.0-beta2

- Zod version is 3.5.1.

### v2.0.0-beta1

- **Warning**: There are breaking changes described below.
  In general, if you used the `defaultResultHandler` before, then you won't have to change much of code.
- **Motivation**. I really like the first version of the library for its simplicity and elegance, 
  but there is one imperfection in it. The available methods and type helpers do not allow to disclose the complete 
  response of the endpoint, including the specification of a successful and error response for which the 
  `ResultHandler` is responsible. So I decided to fix it, although it made the implementation somewhat more 
  complicated, but I found it important. However, it brought a number of benefits, which are also described below.
- Node version required: at least `10.0.0` and the library target now is `ES6`.
- Type `ResultHandler` is no longer exported, please use `createResultHandler()` or `defaultResultHandler`.
- The `setResultHandler()` method of `EndpointsFactory` class has been removed. The `ResultHandlerDefinition` has
  to be specified as an argument of `EndpointsFactory` constructor. You can use `defaultResultHandler` or 
  `createResultHandler()` for this, or you can use `defaultEndpointsFactory`.
```typescript
// before
export const endpointsFactoryBefore = new EndpointsFactory();
// after
export const endpointsFactoryAfter = new EndpointsFactory(defaultResultHandler);
// which is the same as
import {defaultEndpointsFactory} from 'express-zod-api';
```
- The optional property `resultHandler` of `ConfigType` has been replaced with `errorHandler`.
```typescript
// before
resultHandler: ResultHandler; // optional
// after
errorHandler: ResultHandlerDefinition<any, any>; // optional, default: defaultResultHandler
```
- New methods of `Endpoint` class `getPositiveResponseSchema()` and `getNegativeResponseSchema()` return the 
  complete response of the endpoint taking into account the `ResultHandlerDefinition` schemas.
  New methods: `getPositiveMimeTypes()` and `getNegativeMimeTypes()` return the array of mime types.
- New type helping utility: `EndpointResponse<E extends AbstractEndpoint>` to be used instead of `EndpointOutput` 
  returns the complete type of the endpoint response including both positive and negative cases.
```typescript
// Example. Before (v1):
import {EndpointOutput} from 'express-zod-api';

const myEndpointV1 = endpointsFactory
  .build({
    method: 'get',
    input: z.object({...}),
    output: z.object({
      name: z.string(),
    }),
    handler: async () => ({...}),
  });
type MyEndpointOutput = EndpointOutput<typeof myEndpointV1>; // => { name: string }

// and after (v2):
import {defaultEndpointsFactory, EndpointResponse} from 'express-zod-api';

const myEndpointV2 = defaultEndpointsFactory
  .build({
    method: 'get',
    input: z.object({...}),
    output: z.object({
      name: z.string(),
    }),
    handler: async () => ({...}),
  });
type MyEndpointResponse = EndpointResponse<typeof myEndpointV2>; // => the following type 
//  {
//    status: 'success';
//    data: { name: string };
//  } | {
//    status: 'error',
//    error: { message: string };
//  }
```
- Obtaining the OpenAPI / Swagger specification has been simplified: now you can call `getSpecAsYaml()` method 
  directly on `OpenAPI` class instance. There is also a new option `errorResponseDescription`.
```typescript
// before
new OpenAPI({...}).builder.getSpecAsYaml();
// after
new OpenAPI({...}).getSpecAsYaml();
```
- OpenAPI / Swagger specification no longer uses references for schemas and parameters, so they are inline now. 
  Instead of `default` entry in `responses` there are HTTP status codes `200` and `400` that represent positive 
  and negative responses accordingly. Response schemas are now complete as well.
- For creating your own `ResultHandlerDefinition` please use `createResultHandler()`. It also requires 
  `createApiResponse()` to be used that takes a response schema and optional mime types as arguments.
  The endpoint output should be wrapped in `markOutput()`. So far this is the only way I have come up with to 
  facilitate type inference with essentially double nesting of generic types. Typescript does not yet support such 
  features as `MyGenericType<A<B>>`.
```typescript
// before
const myResultHandlerV1: ResultHandler = ({error, request, response, input, output, logger}) => {};
// after
const myResultHandlerV2 = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) => createApiResponse(
    z.object({
      ...,
      someProperty: markOutput(output)
    }), 
    ['mime/type1', 'mime/type2'] // optional, default: application/json
  ),
  getNegativeResponse: () => createApiResponse(z.object({...})),
  handler: ({error, input, output, request, response, logger}) => {}
});
```

## Version 1

### v1.3.1

- Improving the coverage I found a bug and fixed it.
  In some cases there was an issue with CORS requests: [preflight OPTIONS requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests).
  Despite the enabled configuration option `cors: true` the OPTIONS requests have not been handled properly.
  This was leading to the 404 error with a message "Can not OPTIONS \<route\>".
  The issue has been fixed and covered by multiple tests.

### v1.3.0

- Zod version is 3.2.0.
- Minor changes to logging internal server errors.

### v1.2.1

- Additional handling of keys in `Routing` objects.
- `createServer`, `attachRouting` and `new OpenAPI()` may throw an Error in case of using slashes in `Routing` keys.

### v1.2.0

- Ability to specify the endpoint description and [export it to the Swagger / OpenAPI specification](https://github.com/RobinTail/express-zod-api#swagger--openapi-specification).
```typescript
// example
const endpoint = endpointsFactory.build({
  description: 'Here is an example description of the endpoint',
  ...
});
```
- Ability to specify either `methods` or `method` property to `.build()`. This is just a more convenient way for a single method case.
```typescript
// example
const endpoint = endpointsFactory.build({
  method: 'get', // same as methods:['get'] before
  ...
});
```
- Ability for a route to have multiple Endpoints attached depending on different methods.
  It can also be the same Endpoint that handle multiple  methods as well.
  This is a solution for the question raised in issue [#29](https://github.com/RobinTail/express-zod-api/issues/29).
```typescript
// example of different I/O schemas for /v1/user
const routing: Routing = {
  v1: {
    user: new DependsOnMethod({
      get: myEndpointForGetAndDelete,
      delete: myEndpointForGetAndDelete,
      post: myEndpointForPostAndPatch,
      patch: myEndpointForPostAndPatch,
    })
  }
};
```

### v1.1.0

- Zod version is v3.1.0.

### v1.0.0

- First version based on the stable Zod release.
- Zod version is v3.0.2.
- Other dependencies has been upgraded to the latest versions as well.

## Version 0

### v0.7.2
- Readme file updates:
  - Transformations
  - `ResultHandler`
  - better examples

### v0.7.1
- Readme file updates:
  - Concept description update.
  - Excess property check according to the new features of version 0.7.0.
- Refactoring of `defaultResultHandler` and `ResultHandler` calls in `server.ts`.

### v0.7.0
- Zod version is v3.0.0-beta.1.
- Ability to use z.ZodIntersection and z.ZodUnion as an I/O schema for handlers and middlewares.
```typescript
// example
const middleware = createMiddleware({
  input: z.object({
    one: z.string()
  }).or(z.object({
    two: z.number()
  })),
  middleware: async ({input}) => ({
    input // => type: { one: string } | { two: number }
  })
});
```
- Ability to use `z.transform()` in handler's output schema.
```typescript
// example
const endpoint = factory.build({
  methods: ['post'],
  input: z.object({}).nonstrict(),
  output: z.object({
    value: z.string().transform((str) => str.length)
  }),
  handler: async ({input, options}) => ({
    value: 'test' // => in response: { value: 4 }
  })
});
```
- Supplying parameters to `EndpointsFactory::constructor()` is now prohibited. Please use `.addMiddleware()` and `.setResultHandler()` as the right way in order to achieve the correct input schema type in handlers.

### v0.6.1
- Nothing special. Just new logo and the dataflow diagram update.

### v0.6.0
- OpenAPI / Swagger specification generator now supports `ZodNullable`, `ZodOptional`, `ZodUnion` and `ZodIntersection` properties. 

### v0.5.0
- `ConfigType` changes:
```typescript
// before
export interface ConfigType {
  server: {
    listen: number | string;
    cors: boolean;
    jsonParser?: NextHandleFunction;
    resultHandler?: ResultHandler;
  },
  logger: LoggerConfig | winston.Logger;
}

// after
export type ConfigType = ({
  server: { // server configuration
    listen: number | string; // preserved
    jsonParser?: NextHandleFunction; // preserved
  },
} | { // or your custom express app
  app: Express
}) & {
  cors: boolean; // moved
  resultHandler?: ResultHandler; // moved
  logger: LoggerConfig | Logger;
}
```
- More convenient way to attach routing to your custom express app:
```typescript
// before
initRouting({app, logger, config, routing});
// after
const config: ConfigType = {app, ...};
attachRouting(config, routing);
```

### v0.4.1
- Minor Readme file fixes and clarifications.
- Nice dataflow diagram.

### v0.4.0
- Ability to specify your custom Winston logger in config.
- `createLogger()` now accepts `LoggerConfig` as an argument:

```typescript
// before
createLogger(config);
// after
createLogger(config.logger);
```

### v0.3.1
- Minor Readme file fixes and clarifications.

### v0.3.0
- Zod version is v3.0.0-alpha33.
- The syntax for generating the Swagger/OpenAPI specification has changed:
```typescript
// before
generateOpenApi().getSpecAsYaml();
// after
new OpenAPI().builder.getSpecAsYaml();
```

### v0.2.4
- Refactoring of Endpoint::execute() method.

### v0.2.3 & v0.2.2
- First published release.
- Zod version is v3.0.0-alpha4.
