# Express Zod API

Start your API server with I/O schema validation and custom middlewares in minutes.

# Tech

- Schema validation — Zod (latest).
- Webserver — Express.js.
- Logger — Winston.

# Installation

```
coming soon
```

Add the following options to your `tsconfig.json` file in order to make it work as expected:

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

# Tests

```sh
yarn test
```

# Basic usage

Full example in `./example`. You can clone the repo and run `yarn start` to check it out in action.

## Setup config

See `./src/config-type.ts` for all available options.
```typescript
const config: ConfigType = {
  server: {
    listen: 8090,
    cors: true
  },
  logger: {
    level: 'debug',
    color: true
  }
};
```

## Create an endpoints factory

```typescript
const endpointsFactory = new EndpointsFactory();
```

You can also instantly add middlewares to it using `.addMiddleware()` method.

## Create your first endpoint

Note: `options` come from the output of middlewares.

```typescript
const getUserEndpoint = endpointsFactory
  .build({
    methods: ['get'],
    input: z.object({
      id: z.string().transform((id) => parseInt(id, 10))
    }),
    output: z.object({
      name: z.string(),
    }),
    handler: async ({input: {id}, options, logger}) => {
      logger.debug(`Requested id: ${id}`);
      logger.debug('Options:', options);
      const name = 'John Doe';
      return { name: 'John Doe' };
    }
  });
```

You can add middlewares by using `.addMiddleware()` method before `.build()`.
All inputs and outputs are validated.

## Setup routing

```typescript
const routing: Routing = {
  v1: {
    getUser: getUserEndpoint
  }
};
```

## Create your server

```typescript
createServer(config, routing);
```

# Advanced usage
## Create middleware

You can create middlewares separately using `createMiddleware()` function and connect them later.
All outputs of connected middlewares are put in `options` argument of the endpoint handler.
All middleware inputs are also available as the endpoint inputs.

```typescript
// This one provides the method of the request
const methodProviderMiddleware = createMiddleware({
  input: z.object({}).nonstrict(),
  middleware: async ({request}) => ({
    method: request.method.toLowerCase() as Method,
  })
});

// This one performs the authentication 
// using key from the input and token from headers
const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty()
  }),
  middleware: async ({input: {key}, request, logger}) => {
    logger.debug('Checking the key and token...');
    if (key !== '123') {
      throw createHttpError(401, 'Invalid key');
    }
    if (request.headers['token'] !== '456') {
      throw createHttpError(401, 'Invalid token');
    }
    return {token: request.headers['token']};
  }
});
```

## Refinements

You can also implement the validation inside the input schema:

```typescript
const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty()
      .refine((key) => key === '123', 'Invalid key')
  }),
  ...
})
```

## Custom server

You can instantiate your own express app and connect your endpoints the following way:

```typescript
const config: ConfigType = {...};
const logger = createLogger(config);
const routing = {...};

initRouting({app, logger, config, routing});
```

# Known issues

# Excess property check of endpoint output

Unfortunately Typescript does not perform [excess proprety check](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks) for objects resolved in `Promise`, so there is no error during development of endpoint's output.

```typescript
endpointsFactory.build({
  methods, input,
  output: z.object({
    anything: z.number()
  }),
  handler: async () => ({
    anything: 123,
    excessive: 'something' // no type error
  })
});
```

You can achieve this check by assigning the output schema to a constant and reusing it in additional definition of handler's return type:

```typescript
const output = z.object({
  anything: z.number()
});
endpointsFactory.build({
  methods, input, output,
  handler: async (): Promise<z.infer<typeof handlerOutput>> => ({
    anything: 123,
    excessive: 'something' // error TS2322, ok!
  })
});
```
