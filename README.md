# Express Zod API ![CI](https://github.com/RobinTail/express-zod-api/actions/workflows/node.js.yml/badge.svg)

Start your API server with I/O schema validation and custom middlewares in minutes.

1. [Technologies](#technologies)
2. [Concept](#concept)
3. [Installation](#installation)
4. [Basic usage](#basic-usage)
   1. [Set up config](#set-up-config)
   2. [Create an endpoints factory](#create-an-endpoints-factory)
   3. [Create your first endpoint](#create-your-first-endpoint)   
   4. [Set up routing](#set-up-routing)
   5. [Start your server](#start-your-server)
5. [Advanced usage](#advanced-usage)
   1. [Create a middleware](#create-a-middleware)
   2. [Refinements](#refinements)
   3. [Your custom logger](#your-custom-logger)
   4. [Your custom server](#your-custom-server)
6. [Disclosing API specifications](#disclosing-api-specifications)
   1. [Reusing endpoint types on your frontend](#reusing-endpoint-types-on-your-frontend)
   2. [Swagger / OpenAPI Specification](#swagger--openapi-specification)
7. [Known issues](#known-issues)
   1. [Excess property check of endpoint output](#excess-property-check-of-endpoint-output)

# Technologies

- [Typescript](https://www.typescriptlang.org/) first
- Schema validation — [Zod 3.x](https://github.com/colinhacks/zod).
- Webserver — [Express.js](https://expressjs.com/).
- Logger — [Winston](https://github.com/winstonjs/winston).
- Swagger - [OpenAPI 3.x](https://github.com/metadevpro/openapi3-ts)

# Concept

The API always operates object schemas for input and output.
For GET method it provides `request.query` for middlewares and handler as `input` and all properties are `string`.
Input schema may also have transformations for incoming GET params *(see the example [below](#create-your-first-endpoint))*.
For POST, PUT and PATCH the `input` is `request.body` *(parsed JSON)* so properties may have different types.

The handler's argument `options` comes from the returns of the middlewares, which can also supplement and transform the `input` argument.
All inputs and outputs are validated against their object schemas and `ResultHandler` handles the output or possible validation or thrown errors.

![Dataflow](dataflow.svg)

# Installation

```shell
yarn add express-zod-api
# or
npm install express-zod-api
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

# Basic usage

*See full example [here](https://github.com/RobinTail/express-zod-api/tree/master/example).*

## Set up config

```typescript
import {ConfigType} from 'express-zod-api';

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
*See `config-type.d.ts` for all available options.*

## Create an endpoints factory

```typescript
import {EndpointsFactory} from 'express-zod-api';

const endpointsFactory = new EndpointsFactory();
```

You can also instantly add middlewares to it using `.addMiddleware()` method.

## Create your first endpoint

```typescript
import {z} from 'express-zod-api';

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
      logger.debug(`Requested id: ${id}`); // here id is a number
      logger.debug('Options:', options);
      return { name: 'John Doe' };
    }
  });
```

You can add middlewares to the endpoint by using `.addMiddleware()` before `.build()`.

## Set up routing

```typescript
import {Routing} from 'express-zod-api';

const routing: Routing = {
  v1: {
    getUser: getUserEndpoint
  }
};
```
This implementation sets up `getUserEndpoint` to handle requests to the `/v1/getUser` path.  

## Start your server

```typescript
import {createServer} from 'express-zod-api';

createServer(config, routing);
```

# Advanced usage
## Create a middleware

You can create middlewares separately using `createMiddleware()` function and connect them later.
All returns of the connected middlewares are put in `options` argument of the endpoint handler.
All middleware inputs are also available as the endpoint inputs.

```typescript
import {
  createMiddleware, z, Method, createHttpError
} from 'express-zod-api';

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
import {createMiddleware, z} from 'express-zod-api';

const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty()
      .refine((key) => key === '123', 'Invalid key')
  }),
  ...
})
```

## Your custom logger

You can specify your custom Winston logger in config:

```typescript
import * as winston from 'winston';
import {ConfigType, createServer} from 'express-zod-api';

const config: ConfigType = {
   logger: winston.createLogger(),
   ...
};
createServer(config, routing);
```

## Your custom server

You can instantiate your own express app and connect your endpoints the following way. **Please note** that in this case you have to:
- parse `request.body` yourself;
- call `app.listen()` yourself;
- handle `404` errors yourself;

```typescript
import * as express from 'express';
import {ConfigType, attachRouting} from 'express-zod-api';

const app = express();
const config: ConfigType = {app, ...};
const routing = {...};

attachRouting(config, routing);
app.listen();
```

# Disclosing API specifications
## Reusing endpoint types on your frontend

You can export only the types of your endpoints for your front-end:

```typescript
export type GetUserEndpoint = typeof getUserEndpoint;
```

Then use provided helpers to obtain their input and output types:
```typescript
import {EndpointInput, EndpointOutput} from 'express-zod-api';
import {GetUserEndpoint, GetUserEndpoint} from '../your/backend';

type GetUserEndpointInput = EndpointInput<GetUserEndpoint>;
type GetUserEndpointOutput = EndpointOutput<GetUserEndpoint>;
```

## Swagger / OpenAPI Specification

You can generate the specification of your API the following way and write it to a `.yaml` file:

```typescript
import {OpenAPI} from 'express-zod-api';

const yamlString = new OpenAPI({
  routing, 
  version: '1.2.3',
  title: 'Example API',
  serverUrl: 'http://example.com'
}).builder.getSpecAsYaml();
```

# Known issues

## Excess property check of endpoint output

Unfortunately Typescript does not perform [excess property check](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks) for objects resolved in `Promise`, so there is no error during development of endpoint's output.

```typescript
import {z} from 'express-zod-api';

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
import {z} from 'express-zod-api';

const output = z.object({
  anything: z.number()
});

endpointsFactory.build({
  methods, input, output,
  handler: async (): Promise<z.infer<typeof output>> => ({
    anything: 123,
    excessive: 'something' // error TS2322, ok!
  })
});
```
