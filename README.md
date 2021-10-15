# Express Zod API 

![logo](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/logo.svg)

![CI](https://github.com/RobinTail/express-zod-api/actions/workflows/node.js.yml/badge.svg)
![Swagger Validator](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FRobinTail%2Fexpress-zod-api%2Fmaster%2Fexample%2Fexample.swagger.yaml)
![Coverage](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/coverage.svg)

![downloads](https://img.shields.io/npm/dw/express-zod-api)
![npm release](https://img.shields.io/npm/v/express-zod-api?color=teal&label=latest)
![GitHub Repo stars](https://img.shields.io/github/stars/RobinTail/express-zod-api)
![License](https://img.shields.io/npm/l/express-zod-api)

Start your API server with I/O schema validation and custom middlewares in minutes.

1. [Why and what is it for](#why-and-what-is-it-for)
2. [How it works](#how-it-works)
   1. [Technologies](#technologies)
   2. [Concept](#concept)
3. [Quick start](#quick-start) — Fast Track  
   1. [Installation](#installation)
   2. [Set up config](#set-up-config)
   3. [Create an endpoints factory](#create-an-endpoints-factory)
   4. [Create your first endpoint](#create-your-first-endpoint)
   5. [Set up routing](#set-up-routing)
   6. [Start your server](#start-your-server)
   7. [Try it](#try-it)
4. [Fascinating features](#fascinating-features)
   1. [Middlewares](#middlewares)
   2. [Refinements](#refinements)
   3. [Transformations](#transformations)
   4. [Response customization](#response-customization)
   5. [Non-object response](#non-object-response) including file downloads
   6. [File uploads](#file-uploads)
   7. [Customizing logger](#customizing-logger)
   8. [Usage with your own express app](#usage-with-your-own-express-app)
   9. [Multiple schemas for one route](#multiple-schemas-for-one-route)
5. [Disclosing API specification](#disclosing-api-specification)
   1. [Exporting endpoint types to frontend](#exporting-endpoint-types-to-frontend)
   2. [Swagger / OpenAPI Specification](#swagger--openapi-specification)
6. [Known issues](#known-issues)
   1. [Excess property check of endpoint output](#excess-property-check-of-endpoint-output)
7. [Your input to my output](#your-input-to-my-output)

If you're upgrading from v1 please check out the information in [Changelog](CHANGELOG.md#v200-beta1).  

# Why and what is it for

I made this library because of the often repetitive tasks of starting a web server APIs with the need to validate input
data. It integrates and provides the capabilities of popular web server, logger, validation and documenting solutions. 
Therefore, many basic tasks can be accomplished faster and easier, in particular:

- You can describe web server routes as a hierarchical object.
- You can keep the endpoint's input and output type declarations right next to its handler.
- All input and output data types are validated, so it ensures you won't have an empty string, null or undefined where 
  you expect a number.
- Variables within an endpoint handler have types according to the declared schema, so your IDE and Typescript will 
  provide you with necessary hints to focus on bringing your vision to life.
- All of your endpoints can respond in a similar way.
- The expected endpoint input and response types can be exported to the frontend, so you don't get confused about the 
  field names when you implement the client for your API.
- You can generate your API documentation in a Swagger / OpenAPI compatible format.

# How it works

## Technologies

- [Typescript](https://www.typescriptlang.org/) first.
- Web server — [Express.js](https://expressjs.com/).
- Schema validation — [Zod 3.x](https://github.com/colinhacks/zod).
- Logger — [Winston](https://github.com/winstonjs/winston).
- Documenting — [OpenAPI 3.x](https://github.com/metadevpro/openapi3-ts) (formerly known as the Swagger Specification).
- File uploads — [Express-FileUpload](https://github.com/richardgirges/express-fileupload)
  (based on [Busboy](https://github.com/mscdex/busboy))

## Concept
The API operates object schemas for input and output, including unions and intersections of object schemas
(`.or()`, `.and()`), but in general the API can [respond with any data type](#non-object-response) and 
accept [file uploads](#file-uploads).

The object being validated is the `request.query` for GET request, the `request.body` for PUT, PATCH and POST requests, 
or their merging for DELETE requests.

Middlewares can handle inputs and the `request` properties, like headers, for example, to perform the authentication or
provide the endpoint with some properties like the actual request method. The returns of middlewares are combined into
the `options` parameter available to the next connected middlewares and the endpoint's handler.

The `input` parameter of the endpoint's handler consists of the inputs of all connected middlewares along with its own
one. The output of the endpoint's handler goes to the `ResultHandler` which is responsible for transmission of the
final response or possible error.

All inputs and outputs are validated and there are also advanced powerful features like transformations and refinements.
The diagram below can give you a better idea of the dataflow.

![Dataflow](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/dataflow.svg)

# Quick start

## Installation

```shell
yarn add express-zod-api
# or (not recommended)
npm install express-zod-api
```

Add the following option to your `tsconfig.json` file in order to make it work as expected:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## Set up config

```typescript
import {createConfig} from 'express-zod-api';

const config = createConfig({
  server: {
    listen: 8090, // port or socket
  },
  cors: true,
  logger: {
    level: 'debug',
    color: true
  }
});
```
*See all available options [here](https://github.com/RobinTail/express-zod-api/blob/master/src/config-type.ts).*

## Create an endpoints factory

In the basic case, you can just import and use the default factory:
```typescript
import {defaultEndpointsFactory} from 'express-zod-api';
```

*In case you need a global middleware, see [Middlewares](#middlewares).*
*In case you need to customize the response, see [Response customization](#response-customization).*

## Create your first endpoint

```typescript
import {z} from 'express-zod-api';

const helloWorldEndpoint = defaultEndpointsFactory.build({
  method: 'get',
  input: z.object({ // for empty input use z.object({})
    name: z.string().optional(),
  }),
  output: z.object({
    greetings: z.string(),
  }),
  handler: async ({input: {name}, options, logger}) => {
    logger.debug('Options:', options); // middlewares provide options
    return { greetings: `Hello, ${name || 'World'}. Happy coding!` };
  }
});
```

*In case you want it to handle multiple methods use `methods` property instead of `method`.* 

## Set up routing

Connect your endpoint to the `/v1/hello` route:

```typescript
import {Routing} from 'express-zod-api';

const routing: Routing = {
  v1: {
    hello: helloWorldEndpoint
  }
};
```

## Start your server

```typescript
import {createServer} from 'express-zod-api';

createServer(config, routing);
```

You can disable startup logo using `startupLogo` entry of your config.
See the [full implementation example here](https://github.com/RobinTail/express-zod-api/tree/master/example).

## Try it

Execute the following command:
```shell
curl -L -X GET 'localhost:8090/v1/hello?name=Rick'
```

You should receive the following response:
```json lines
{"status":"success","data":{"greetings":"Hello, Rick. Happy coding!"}}
```

# Fascinating features

## Middlewares

Middleware can authenticate using input or `request` headers, and can provide endpoint handlers with `options`.
Inputs of middlewares are also available to endpoint handlers within `input`.

Here is an example on how to provide parameters from the request path.

```typescript
import {createMiddleware} from 'express-zod-api';

const paramsProviderMiddleware = createMiddleware({
  input: z.object({}), // means no inputs
  middleware: async ({request}) => ({
    params: request.params
  })
});
```

Then, you can connect your endpoint to a path like `/user/:id`, where `id` is a parameter:

```typescript
const routing: Routing = {
  user: {
    ':id': yourEndpoint
  }
};
```

By using `.addMiddleware()` method before `.build()` you can connect it to the endpoint:

```typescript
const yourEndpoint = defaultEndpointsFactory
  .addMiddleware(yourMiddleware)
  .build({
     ...,
     handler: async ({options}) => {
       // options.id is your param from /user/:id
     }   
  });
```

Here is an example the authentication middleware, that checks a `key` from input and `token` from headers:

```typescript
import {
  createMiddleware, createHttpError, z
} from 'express-zod-api';

const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty()
  }),
  middleware: async ({input: {key}, request, logger}) => {
    logger.debug('Checking the key and token...');
    const user = await db.Users.findOne({key});
    if (!user) {
      throw createHttpError(401, 'Invalid key');
    }
    if (request.headers['token'] !== user.token) {
      throw createHttpError(401, 'Invalid token');
    }
    return { user }; // provides endpoints with options.user
  }
});
```

You can connect the middleware to endpoints factory right away, making it kind of global:

```typescript
import {defaultEndpointsFactory} from 'express-zod-api';

const endpointsFactory = defaultEndpointsFactory
  .addMiddleware(authMiddleware);
```

You can connect as many middlewares as you want, they will be executed in order.

## Refinements

By the way, you can implement additional validation within schema. 
Validation errors are reported in a response with a status code `400`.

```typescript
import {createMiddleware, z} from 'express-zod-api';

const nicknameConstraintMiddleware = createMiddleware({
  input: z.object({
    nickname: z.string().nonempty().refine(
      (nick) => !/^\d.*$/.test(nick), 
      'Nickname cannot start with a digit'
    )
  }),
  ...
})
```

## Transformations

Since parameters of GET requests come in the form of strings, there is often a need to transform them into numbers or 
arrays of numbers.

```typescript
import {z} from 'express-zod-api';

const getUserEndpoint = endpointsFactory.build({
  method: 'get',
  input: z.object({
    id: z.string().transform((id) => parseInt(id, 10)),
    ids: z.string().transform(
      (ids) => ids.split(',').map((id) => parseInt(id, 10))
    )
  }),
  output: z.object({...}),
  handler: async ({input: {id, ids}, logger}) => {
    logger.debug('id', id); // type: number
    logger.debug('ids', ids); // type: number[]
  }
});
```

## Response customization

`ResultHandler` is responsible for transmission of the response containing the endpoint output or an error.
The `defaultResultHandler` sets the HTTP status code and ensures the following type of the response:

```typescript
type DefaultResponse<OUT> =
  | { // Positive response
      status: 'success',
      data: OUT
    }
  | { // or Negative response
    status: 'error',
    error: {
      message: string;
    }
  };
```

You can create your own result handler by using this example as a template:

```typescript
import {
  createResultHandler, createApiResponse,
  IOSchema, markOutput, z
} from 'express-zod-api';

export const yourResultHandler = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) =>
    createApiResponse(
      z.object({
        data: markOutput(output)
      }),
      'application/json' // optional, or array of mime types
    ),
  getNegativeResponse: () => createApiResponse(
    z.object({ error: z.string() })
  ),
  handler: ({error, input, output, request, response, logger}) => {
    // your implementation
  }
});
```

Then you need to use it as an argument for `EndpointsFactory` instance creation:

```typescript
import {EndpointsFactory} from 'express-zod-api';

const endpointsFactory = new EndpointsFactory(yourResultHandler);
```

Please note: `ResultHandler` must handle any errors and not throw its own. Otherwise, the case will be passed to the 
`LastResortHandler`, which will set the status code to `500` and send the error message as plain text.

## Non-object response

Thus, you can configure non-object responses too, for example, to send an image file.

You can find two approaches to `EndpointsFactory` and `ResultHandler` implementation 
[in this example](https://github.com/RobinTail/express-zod-api/blob/master/example/factories.ts). 
One of them implements file streaming, in this case the endpoint just has to provide the filename.
The response schema generally may be just `z.string()`, but I made more specific `z.file()` that also supports
`.binary()` and `.base64()` refinements which are reflected in the 
[generated documentation](#swagger--openapi-specification).

```typescript
const fileStreamingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => createApiResponse(
      z.file().binary(), 'image/*'
    ),
    getNegativeResponse: () => createApiResponse(
      z.string(), 'text/plain'
    ),
    handler: ({response, error, output}) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if ('filename' in output) {
        fs.createReadStream(output.filename)
          .pipe(response.type(output.filename));
      } else {
        response.status(400).send('Filename is missing');
      }
    }
  })
);
```

## File uploads

You can switch the `Endpoint` to handle requests with the `multipart/formdata` content type instead of JSON. 
Together with a corresponding configuration option, this makes it possible to handle file uploads.
Here is a simplified example:

```typescript
import {createConfig, z, defaultEndpointsFactory} from 'express-zod-api';

const config = createConfig({
  server: {
    upload: true, // <- required
    ...
  },
});

const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: 'post',
  type: 'upload', // <- required
  input: z.object({
    avatar: z.upload()
  }),
  output: z.object({...}),
  handler: async ({input: {avatar}}) => {
    // avatar: {name, mv(), mimetype, data, size, ...}
    // avatar.truncated is true on failure
    return {...};
  }
});
```

*You can still send other data and specify additional `input` parameters, including arrays and objects.*

## Customizing logger

You can specify your custom Winston logger in config:

```typescript
import * as winston from 'winston';
import {createConfig} from 'express-zod-api';

const logger = winston.createLogger({...}); 
const config = createConfig({ logger, ... });
```

## Usage with your own express app

If you already have your own configured express application, or you find the library settings not enough,
you can connect your routing to the app instead of using `createServer()`.

```typescript
import * as express from 'express';
import {createConfig, attachRouting} from 'express-zod-api';

const app = express();
const config = createConfig({app, ...});
const routing = {...};

const {notFoundHandler, logger} = attachRouting(config, routing);

app.use(notFoundHandler); // optional
app.listen();

logger.info('Glory to science!');
```

**Please note** that in this case you probably need to parse `request.body`, call `app.listen()` and handle `404` 
errors yourself. In this regard `attachRouting()` provides you with `notFoundHandler` which you can optionally connect
to your custom express app.

## Multiple schemas for one route

Thanks to the `DependsOnMethod` class a route may have multiple Endpoints attached depending on different methods.
It can also be the same Endpoint that handles multiple methods as well.
```typescript
import {DependsOnMethod} from 'express-zod-api';

// the route /v1/user has two Endpoints 
// which handle a couple of methods each
const routing: Routing = {
  v1: {
    user: new DependsOnMethod({
      get: yourEndpointA,
      delete: yourEndpointA,
      post: yourEndpointB,
      patch: yourEndpointB,
    })
  }
};
```

# Disclosing API specification

## Exporting endpoint types to frontend

You can export only the types of your endpoints for your frontend. Here is an approach:

```typescript
export type YourEndpointType = typeof yourEndpoint;
```

Then use provided helpers to obtain their input and response types:
```typescript
import {EndpointInput, EndpointResponse} from 'express-zod-api'; 
import type {YourEndpointType} from '../your/backend';
//     ^---- please note the import syntax of the type only

type YourEndpointInput = EndpointInput<YourEndpointType>;
type YourEndpointResponse = EndpointResponse<YourEndpointType>;
```

## Swagger / OpenAPI Specification

You can generate the specification of your API the following way and write it to a `.yaml` file, 
that can be used as the documentation:

```typescript
import {OpenAPI} from 'express-zod-api';

const yamlString = new OpenAPI({
  routing, 
  version: '1.2.3',
  title: 'Example API',
  serverUrl: 'http://example.com'
}).getSpecAsYaml();
```

*See the example of the generated documentation 
[here](https://github.com/RobinTail/express-zod-api/blob/master/example/example.swagger.yaml)*

# Known issues

## Excess property check of endpoint output

Unfortunately Typescript does not perform 
[excess property check](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks) for 
objects resolved in `Promise`, so there is no error during development of endpoint's output.

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

You can achieve this check by assigning the output schema to a constant and reusing it in additional definition of 
handler's return type:

```typescript
import {z} from 'express-zod-api';

const output = z.object({
  anything: z.number()
});

endpointsFactory.build({
  methods, input, output,
  handler: async (): Promise<z.input<typeof output>> => ({
    anything: 123,
    excessive: 'something' // error TS2322, ok!
  })
});
```

# Your input to my output

Do you have a question or idea? 
Your feedback is highly appreciated in [Discussions section](https://github.com/RobinTail/express-zod-api/discussions).

Found a bug?
Please let me know in [Issues section](https://github.com/RobinTail/express-zod-api/issues).

Found a vulnerability or other security issue?
Please refer to [Security policy](https://github.com/RobinTail/express-zod-api/blob/master/SECURITY.md).
