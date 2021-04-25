# Changelog

## Version 0

### v0.4.2
- Dataflow diagram improvement

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
