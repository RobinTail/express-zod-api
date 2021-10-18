# Changelog

## Version 1

### v1.3.3

- Fixed issue #169. Suddenly I found out that `yarn` does NOT respect `yarn.lock` files of sub-dependencies. So the
  version of `zod` defined in my `yarn.lock` file does not actually mean anything when doing `yarn add express-zod-api`.
  - The recently released version of Zod (3.10.x) seems to have some breaking changes, it should not be installed
    according to my lock file.
  - I'm locking the dependency versions in `package.json` file from now on.
  - `npm` users are also affected since the distributed lock file is for `yarn`.

### v1.3.2

- Updated the development package `path-parse` from 1.0.6 to 1.0.7.
  An audit revealed a vulnerability, but this package is not included in the build.
```
info Reasons this module exists
   - "jest#@jest#core#jest-resolve#resolve" depends on it
   - Hoisted from "jest#@jest#core#jest-resolve#resolve#path-parse"
```

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
