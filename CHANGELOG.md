# Changelog

## Version 0

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
- More convenient way to attach routing to your custom express app
```typescript
// before
initRouting({app, logger, config, routing});
// after
const config: ConfigType = {app, ...};
attachRouting(config, routing);
```

### v0.4.1
- Minor Readme file fixes and clarifications
- Nice dataflow diagram

### v0.4.0
- Ability to specify your custom Winston logger in config
- `createLogger()` now accepts `LoggerConfig` as an argument

```typescript
// before
createLogger(config);
// after
createLogger(config.logger);
```

### v0.3.1
- Minor Readme file fixes and clarifications

### v0.3.0
- Zod version is v3.0.0-alpha33
- The syntax for generating the Swagger/OpenAPI specification has changed:
```typescript
// before
generateOpenApi().getSpecAsYaml();
// after
new OpenAPI().builder.getSpecAsYaml();
```

### v0.2.4
- Refactoring of Endpoint::execute() method

### v0.2.3 & v0.2.2
- First published release
- Zod version is v3.0.0-alpha4
