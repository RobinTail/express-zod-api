# Changelog

## Version 1

### v1.2.0

- Ability to specify the endpoint description and [export it to the Swagger / OpenAPI specification](https://github.com/RobinTail/express-zod-api#swagger--openapi-specification).
```typescript
// example
const endpoint = endpointsFactory.build({
  methods: ['get'],
  description: 'Here is an example description of the endpoint',
  input: z.object({...}),
  output: z.object({...}),
  handler: async ({input, options, logger}) => {}
});
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
