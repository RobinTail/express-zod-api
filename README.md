# Express Zod API

![logo](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/logo.svg)

![CI](https://github.com/RobinTail/express-zod-api/actions/workflows/node.js.yml/badge.svg)
![OpenAPI](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FRobinTail%2Fexpress-zod-api%2Fmaster%2Fexample%2Fexample.documentation.yaml&label=OpenAPI)
[![coverage](https://coveralls.io/repos/github/RobinTail/express-zod-api/badge.svg)](https://coveralls.io/github/RobinTail/express-zod-api)

![downloads](https://img.shields.io/npm/dw/express-zod-api.svg)
![npm release](https://img.shields.io/npm/v/express-zod-api.svg?color=green25&label=latest)
![GitHub Repo stars](https://img.shields.io/github/stars/RobinTail/express-zod-api.svg?style=flat)
![License](https://img.shields.io/npm/l/express-zod-api.svg?color=green25)

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
   6. [Create your server](#create-your-server)
   7. [Try it](#try-it)
4. [Basic features](#basic-features)
   1. [Middlewares](#middlewares)
   2. [Options](#options)
   3. [Using native express middlewares](#using-native-express-middlewares)
   4. [Refinements](#refinements)
   5. [Transformations](#transformations)
   6. [Dealing with dates](#dealing-with-dates)
   7. [Cross-Origin Resource Sharing](#cross-origin-resource-sharing) (CORS)
   8. [Enabling HTTPS](#enabling-https)
   9. [Customizing logger](#customizing-logger)
   10. [Child logger](#child-logger)
   11. [Enabling compression](#enabling-compression)
5. [Advanced features](#advanced-features)
   1. [Customizing input sources](#customizing-input-sources)
   2. [Route path params](#route-path-params)
   3. [Multiple schemas for one route](#multiple-schemas-for-one-route)
   4. [Response customization](#response-customization)
   5. [Non-object response](#non-object-response) including file downloads
   6. [File uploads](#file-uploads)
   7. [Serving static files](#serving-static-files)
   8. [Connect to your own express app](#connect-to-your-own-express-app)
   9. [Testing endpoints](#testing-endpoints)
6. [Special needs](#special-needs)
   1. [Different responses for different status codes](#different-responses-for-different-status-codes)
   2. [Array response](#array-response) for migrating legacy APIs
   3. [Headers as input source](#headers-as-input-source)
   4. [Accepting raw data](#accepting-raw-data)
   5. [Subscriptions](#subscriptions)
7. [Integration and Documentation](#integration-and-documentation)
   1. [Zod Plugin](#zod-plugin)
   2. [Generating a Frontend Client](#generating-a-frontend-client)
   3. [Creating a documentation](#creating-a-documentation)
   4. [Tagging the endpoints](#tagging-the-endpoints)
   5. [Customizable brands handling](#customizable-brands-handling)
8. [Caveats](#caveats)
   1. [Coercive schema of Zod](#coercive-schema-of-zod)
   2. [Excessive properties in endpoint output](#excessive-properties-in-endpoint-output)
9. [Your input to my output](#your-input-to-my-output)

You can find the release notes and migration guides in [Changelog](CHANGELOG.md).

# Why and what is it for

I made this library because of the often repetitive tasks of starting a web server APIs with the need to validate input
data. It integrates and provides the capabilities of popular web server, logging, validation and documenting solutions.
Therefore, many basic tasks can be accomplished faster and easier, in particular:

- You can describe web server routes as a hierarchical object.
- You can keep the endpoint's input and output type declarations right next to its handler.
- All input and output data types are validated, so it ensures you won't have an empty string, null or undefined where
  you expect a number.
- Variables within an endpoint handler have types according to the declared schema, so your IDE and Typescript will
  provide you with necessary hints to focus on bringing your vision to life.
- All of your endpoints can respond in a consistent way.
- The expected endpoint input and response types can be exported to the frontend, so you don't get confused about the
  field names when you implement the client for your API.
- You can generate your API documentation in OpenAPI 3.1 and JSON Schema compatible format.

# How it works

## Technologies

- [Typescript](https://www.typescriptlang.org/) first.
- Web server — [Express.js](https://expressjs.com/).
- Schema validation — [Zod 3.x](https://github.com/colinhacks/zod) including [Zod Plugin](#zod-plugin).
- Supports any logger having `info()`, `debug()`, `error()` and `warn()` methods;
  - Built-in console logger with colorful and pretty inspections by default.
- Generators:
  - Documentation — [OpenAPI 3.1](https://github.com/metadevpro/openapi3-ts) (former Swagger);
  - Client side types — inspired by [zod-to-ts](https://github.com/sachinraja/zod-to-ts).
- File uploads — [Express-FileUpload](https://github.com/richardgirges/express-fileupload)
  (based on [Busboy](https://github.com/mscdex/busboy)).
- Supports any testing framework having a function mocking method;
  - [Jest](https://github.com/jestjs/jest) and [Vitest](https://github.com/vitest-dev/vitest)
    are both supported automatically.

## Concept

The API operates object schemas for input and output validation.
The object being validated is the combination of certain `request` properties.
It is available to the endpoint handler as the `input` parameter.
Middlewares have access to all `request` properties, they can provide endpoints with `options`.
The object returned by the endpoint handler is called `output`. It goes to the `ResultHandler` which is
responsible for transmitting consistent responses containing the `output` or possible error.
Much can be customized to fit your needs.

![Dataflow](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/dataflow.svg)

# Quick start

## Installation

Run one of the following commands to install the library, its peer dependencies and packages for types assistance.

```shell
yarn add express-zod-api express zod typescript http-errors
yarn add --dev @types/express @types/node @types/http-errors
```

or

```shell
npm install express-zod-api express zod typescript http-errors
npm install -D @types/express @types/node @types/http-errors
```

Ensure having the following options in your `tsconfig.json` file in order to make it work as expected:

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true
  }
}
```

## Set up config

Create a minimal configuration. _See all available options
[in sources](https://github.com/RobinTail/express-zod-api/blob/master/src/config-type.ts)._

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    listen: 8090, // port, UNIX socket or options
  },
  cors: true,
  logger: { level: "debug", color: true },
});
```

## Create an endpoints factory

In the basic case, you can just import and use the default factory.
_See also [Middlewares](#middlewares) and [Response customization](#response-customization)._

```typescript
import { defaultEndpointsFactory } from "express-zod-api";
```

## Create your first endpoint

The endpoint responds with "Hello, World" or "Hello, {name}" if the name is supplied within `GET` request payload.

```typescript
import { z } from "zod";

const helloWorldEndpoint = defaultEndpointsFactory.build({
  method: "get", // or methods: ["get", "post", ...]
  input: z.object({
    // for empty input use z.object({})
    name: z.string().optional(),
  }),
  output: z.object({
    greetings: z.string(),
  }),
  handler: async ({ input: { name }, options, logger }) => {
    logger.debug("Options:", options); // middlewares provide options
    return { greetings: `Hello, ${name || "World"}. Happy coding!` };
  },
});
```

## Set up routing

Connect your endpoint to the `/v1/hello` route:

```typescript
import { Routing } from "express-zod-api";

const routing: Routing = {
  v1: {
    hello: helloWorldEndpoint,
  },
};
```

## Create your server

See the [complete implementation example](https://github.com/RobinTail/express-zod-api/tree/master/example).

```typescript
import { createServer } from "express-zod-api";

createServer(config, routing);
```

## Try it

Start your application and execute the following command:

```shell
curl -L -X GET 'localhost:8090/v1/hello?name=Rick'
```

You should receive the following response:

```json
{ "status": "success", "data": { "greetings": "Hello, Rick. Happy coding!" } }
```

# Basic features

## Middlewares

Middleware can authenticate using input or `request` headers, and can provide endpoint handlers with `options`.
Inputs of middlewares are also available to endpoint handlers within `input`.

Here is an example of the authentication middleware, that checks a `key` from input and `token` from headers:

```typescript
import { z } from "zod";
import createHttpError from "http-errors";
import { createMiddleware } from "express-zod-api";

const authMiddleware = createMiddleware({
  security: {
    // this information is optional and used for generating documentation
    and: [
      { type: "input", name: "key" },
      { type: "header", name: "token" },
    ],
  },
  input: z.object({
    key: z.string().min(1),
  }),
  middleware: async ({ input: { key }, request, logger }) => {
    logger.debug("Checking the key and token");
    const user = await db.Users.findOne({ key });
    if (!user) {
      throw createHttpError(401, "Invalid key");
    }
    if (request.headers.token !== user.token) {
      throw createHttpError(401, "Invalid token");
    }
    return { user }; // provides endpoints with options.user
  },
});
```

By using `.addMiddleware()` method before `.build()` you can connect it to the endpoint:

```typescript
const yourEndpoint = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .build({
    // ...,
    handler: async ({ options }) => {
      // options.user is the user returned by authMiddleware
    },
  });
```

You can connect the middleware to endpoints factory right away, making it kind of global:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const endpointsFactory = defaultEndpointsFactory.addMiddleware(authMiddleware);
```

You can connect as many middlewares as you want, they will be executed in order.

## Options

In case you'd like to provide your endpoints with options that do not depend on Request, like non-persistent connection
to a database, consider shorthand method `addOptions`. For static options consider reusing `const` across your files.

```typescript
import { readFile } from "node:fs/promises";
import { defaultEndpointsFactory } from "express-zod-api";

const endpointsFactory = defaultEndpointsFactory.addOptions(async () => {
  // caution: new connection on every request:
  const db = mongoose.connect("mongodb://connection.string");
  const privateKey = await readFile("private-key.pem", "utf-8");
  return { db, privateKey };
});
```

**Notice on resources cleanup**: If necessary, you can release resources at the end of the request processing in a
custom [Result Handler](#response-customization):

```typescript
import { createResultHandler } from "express-zod-api";

const resultHandlerWithCleanup = createResultHandler({
  handler: ({ options }) => {
    // necessary to check for certain option presence:
    if ("db" in options && options.db) {
      options.db.connection.close(); // sample cleanup
    }
  },
});
```

## Using native express middlewares

There are two ways of connecting the native express middlewares depending on their nature and your objective.

In case it's a middleware establishing and serving its own routes, or somehow globally modifying the behaviour, or
being an additional request parser (like `cookie-parser`), use the `beforeRouting` option.
However, it might be better to avoid `cors` here — [the library handles it on its own](#cross-origin-resource-sharing).

```typescript
import { createConfig } from "express-zod-api";
import ui from "swagger-ui-express";

const config = createConfig({
  server: {
    listen: 80,
    beforeRouting: ({ app, logger }) => {
      logger.info("Serving the API documentation at https://example.com/docs");
      app.use("/docs", ui.serve, ui.setup(documentation));
    },
  },
});
```

In case you need a special processing of `request`, or to modify the `response` for selected endpoints, use the method
`addExpressMiddleware()` of `EndpointsFactory` (or its alias `use()`). The method has two optional features: a provider
of [options](#options) and an error transformer for adjusting the response status code.

```typescript
import { defaultEndpointsFactory } from "express-zod-api";
import createHttpError from "http-errors";
import { auth } from "express-oauth2-jwt-bearer";

const factory = defaultEndpointsFactory.use(auth(), {
  provider: (req) => ({ auth: req.auth }), // optional, can be async
  transformer: (err) => createHttpError(401, err.message), // optional
});
```

## Refinements

You can implement additional validations within schemas using refinements.
Validation errors are reported in a response with a status code `400`.

```typescript
import { z } from "zod";
import { createMiddleware } from "express-zod-api";

const nicknameConstraintMiddleware = createMiddleware({
  input: z.object({
    nickname: z
      .string()
      .min(1)
      .refine(
        (nick) => !/^\d.*$/.test(nick),
        "Nickname cannot start with a digit",
      ),
  }),
  // ...,
});
```

By the way, you can also refine the whole I/O object, for example in case you need a complex validation of its props.

```typescript
const endpoint = endpointsFactory.build({
  input: z
    .object({
      email: z.string().email().optional(),
      id: z.string().optional(),
      otherThing: z.string().optional(),
    })
    .refine(
      (inputs) => Object.keys(inputs).length >= 1,
      "Please provide at least one property",
    ),
  // ...,
});
```

## Transformations

Since parameters of GET requests come in the form of strings, there is often a need to transform them into numbers or
arrays of numbers.

```typescript
import { z } from "zod";

const getUserEndpoint = endpointsFactory.build({
  method: "get",
  input: z.object({
    id: z.string().transform((id) => parseInt(id, 10)),
    ids: z
      .string()
      .transform((ids) => ids.split(",").map((id) => parseInt(id, 10))),
  }),
  output: z.object({
    /* ... */
  }),
  handler: async ({ input: { id, ids }, logger }) => {
    logger.debug("id", id); // type: number
    logger.debug("ids", ids); // type: number[]
  },
});
```

## Dealing with dates

Dates in Javascript are one of the most troublesome entities. In addition, `Date` cannot be passed directly in JSON
format. Therefore, attempting to return `Date` from the endpoint handler results in it being converted to an ISO string
in actual response by calling
[toJSON()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toJSON),
which in turn calls
[toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString).
It is also impossible to transmit the `Date` in its original form to your endpoints within JSON. Therefore, there is
confusion with original method ~~z.date()~~ that should not be used within IO schemas of your API.

In order to solve this problem, the library provides two custom methods for dealing with dates: `ez.dateIn()` and
`ez.dateOut()` for using within input and output schemas accordingly.

`ez.dateIn()` is a transforming schema that accepts an ISO `string` representation of a `Date`, validates it, and
provides your endpoint handler or middleware with a `Date`. It supports the following formats:

```text
2021-12-31T23:59:59.000Z
2021-12-31T23:59:59Z
2021-12-31T23:59:59
2021-12-31
```

`ez.dateOut()`, on the contrary, accepts a `Date` and provides `ResultHanlder` with a `string` representation in ISO
format for the response transmission. Consider the following simplified example for better understanding:

```typescript
import { z } from "zod";
import { ez, defaultEndpointsFactory } from "express-zod-api";

const updateUserEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.object({
    userId: z.string(),
    birthday: ez.dateIn(), // string -> Date
  }),
  output: z.object({
    createdAt: ez.dateOut(), // Date -> string
  }),
  handler: async ({ input }) => {
    // input.birthday is Date
    return {
      // transmitted as "2022-01-22T00:00:00.000Z"
      createdAt: new Date("2022-01-22"),
    };
  },
});
```

## Cross-Origin Resource Sharing

You can enable your API for other domains using the corresponding configuration option `cors`.
It's _not optional_ to draw your attention to making the appropriate decision, however, it's enabled in the
[Quick start example](#set-up-config) above, assuming that in most cases you will want to enable this feature.
See [MDN article](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) for more information.

In addition to being a boolean, `cors` can also be assigned a function that overrides default CORS headers.
That function has several parameters and can be asynchronous.

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  // ... other options
  cors: ({ defaultHeaders, request, endpoint, logger }) => ({
    ...defaultHeaders,
    "Access-Control-Max-Age": "5000",
  }),
});
```

Please note: If you only want to send specific headers on requests to a specific endpoint, consider the
[Middlewares](#middlewares) or [response customization approach](#response-customization).

## Enabling HTTPS

The modern API standard often assumes the use of a secure data transfer protocol, confirmed by a TLS certificate, also
often called an SSL certificate in habit. When using the `createServer()` method, you can additionally configure and
run the HTTPS server.

```typescript
import { createConfig, createServer } from "express-zod-api";

const config = createConfig({
  server: {
    listen: 80,
  },
  https: {
    options: {
      cert: fs.readFileSync("fullchain.pem", "utf-8"),
      key: fs.readFileSync("privkey.pem", "utf-8"),
    },
    listen: 443, // port, UNIX socket or options
  },
  // ... cors, logger, etc
});

// 'await' is only needed if you're going to use the returned entities.
// For top level CJS you can wrap you code with (async () => { ... })()
const { app, httpServer, httpsServer, logger } = await createServer(
  config,
  routing,
);
```

Ensure having `@types/node` package installed. At least you need to specify the port (usually it is 443) or UNIX socket,
certificate and the key, issued by the certifying authority. For example, you can acquire a free TLS certificate for
your API at [Let's Encrypt](https://letsencrypt.org/).

## Customizing logger

If the simple console output of the built-in logger is not enough for you, you can connect any other compatible one.
It must support at least the following methods: `info()`, `debug()`, `error()` and `warn()`.
Winston and Pino support is well known. Here is an example configuring `pino` logger with `pino-pretty` extension:

```typescript
import pino, { Logger } from "pino";
import { createConfig } from "express-zod-api";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});
const config = createConfig({ logger });

// Setting the type of logger used
declare module "express-zod-api" {
  interface LoggerOverrides extends Logger {}
}
```

## Child logger

In case you need a dedicated logger for each request (for example, equipped with a request ID), you can specify the
`childLoggerProvider` option in your configuration. The function accepts the initially defined logger and the request,
it can also be asynchronous. The child logger returned by that function will replace the `logger` in all handlers.

```typescript
import { createConfig } from "express-zod-api";
import { randomUUID } from "node:crypto";

const config = createConfig({
  // logger: ...,
  childLoggerProvider: ({ parent, request }) =>
    parent.child({ requestId: randomUUID() }), // assuming a custom logger having .child() method
});
```

## Enabling compression

According to [Express.js best practices guide](http://expressjs.com/en/advanced/best-practice-performance.html)
it might be a good idea to enable GZIP compression of your API responses.

Install the following additional packages: `compression` and `@types/compression`, and enable or configure compression:

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    /** @link https://www.npmjs.com/package/compression#options */
    compression: { threshold: "1kb" }, // or true
  },
});
```

In order to receive a compressed response the client should include the following header in the request:
`Accept-Encoding: gzip, deflate`. Only responses with compressible content types are subject to compression.

# Advanced features

## Customizing input sources

You can customize the list of `request` properties that are combined into `input` that is being validated and available
to your endpoints and middlewares. The order here matters: each next item in the array has a higher priority than its
previous sibling.

```typescript
import { createConfig } from "express-zod-api";

createConfig({
  inputSources: {
    // the defaults are:
    get: ["query", "params"],
    post: ["body", "params", "files"],
    put: ["body", "params"],
    patch: ["body", "params"],
    delete: ["query", "params"],
  }, // ...
});
```

## Route path params

You can describe the route of the endpoint using parameters:

```typescript
import { Routing } from "express-zod-api";

const routing: Routing = {
  v1: {
    user: {
      // route path /v1/user/:id, where :id is the path param
      ":id": getUserEndpoint,
      // use the empty string to represent /v1/user if needed:
      // "": listAllUsersEndpoint,
    },
  },
};
```

You then need to specify these parameters in the endpoint input schema in the usual way:

```typescript
const getUserEndpoint = endpointsFactory.build({
  method: "get",
  input: z.object({
    // id is the route path param, always string
    id: z.string().transform((value) => parseInt(value, 10)),
    // other inputs (in query):
    withExtendedInformation: z.boolean().optional(),
  }),
  output: z.object({
    /* ... */
  }),
  handler: async ({ input: { id } }) => {
    // id is the route path param, number
  },
});
```

## Multiple schemas for one route

Thanks to the `DependsOnMethod` class a route may have multiple Endpoints attached depending on different methods.
It can also be the same Endpoint that handles multiple methods as well.

```typescript
import { DependsOnMethod } from "express-zod-api";

// the route /v1/user has two Endpoints
// which handle a couple of methods each
const routing: Routing = {
  v1: {
    user: new DependsOnMethod({
      get: yourEndpointA,
      delete: yourEndpointA,
      post: yourEndpointB,
      patch: yourEndpointB,
    }),
  },
};
```

_See also [Different responses for different status codes](#different-responses-for-different-status-codes)_.

## Response customization

`ResultHandler` is responsible for transmitting consistent responses containing the endpoint output or an error.
The `defaultResultHandler` sets the HTTP status code and ensures the following type of the response:

```typescript
type DefaultResponse<OUT> =
  | {
      // Positive response
      status: "success";
      data: OUT;
    }
  | {
      // or Negative response
      status: "error";
      error: {
        message: string;
      };
    };
```

You can create your own result handler by using this example as a template:

```typescript
import { z } from "zod";
import {
  createResultHandler,
  IOSchema,
  getStatusCodeFromError,
  getMessageFromError,
} from "express-zod-api";

const yourResultHandler = createResultHandler({
  getPositiveResponse: (output: IOSchema) => ({
    schema: z.object({ data: output }),
    mimeType: "application/json", // optinal, or mimeTypes for array
  }),
  getNegativeResponse: () => z.object({ error: z.string() }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (!error) {
      // your implementation
      return;
    }
    const statusCode = getStatusCodeFromError(error);
    const message = getMessageFromError(error);
    // your implementation
  },
});
```

Note: `OutputValidationError` and `InputValidationError` are also available for your custom error handling.
_See also [Different responses for different status codes](#different-responses-for-different-status-codes)_.

After creating your custom `ResultHandler` you can use it as an argument for `EndpointsFactory` instance creation:

```typescript
import { EndpointsFactory } from "express-zod-api";

const endpointsFactory = new EndpointsFactory(yourResultHandler);
```

Please note: `ResultHandler` must handle any errors and not throw its own. Otherwise, the case will be passed to the
`LastResortHandler`, which will set the status code to `500` and send the error message as plain text.

## Non-object response

Thus, you can configure non-object responses too, for example, to send an image file.

You can find two approaches to `EndpointsFactory` and `ResultHandler` implementation
[in this example](https://github.com/RobinTail/express-zod-api/blob/master/example/factories.ts).
One of them implements file streaming, in this case the endpoint just has to provide the filename.
The response schema generally may be just `z.string()`, but I made more specific `ez.file()` that also supports
`ez.file("binary")` and `ez.file("base64")` variants which are reflected in the
[generated documentation](#creating-a-documentation).

```typescript
const fileStreamingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => ({
      schema: ez.file("buffer"),
      mimeType: "image/*",
    }),
    getNegativeResponse: () => ({ schema: z.string(), mimeType: "text/plain" }),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if ("filename" in output) {
        fs.createReadStream(output.filename).pipe(
          response.type(output.filename),
        );
      } else {
        response.status(400).send("Filename is missing");
      }
    },
  }),
);
```

## File uploads

Install the following additional packages: `express-fileupload` and `@types/express-fileupload`, and enable or
configure file uploads:

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    upload: true, // or options
  },
});
```

Refer to [documentation](https://www.npmjs.com/package/express-fileupload#available-options) on available options.
Some options are forced in order to ensure the correct workflow: `abortOnLimit: false`, `parseNested: true`, `logger`
is assigned with `.debug()` method of the configured logger, and `debug` is enabled by default.
The `limitHandler` option is replaced by the `limitError` one. You can also connect an additional middleware for
restricting the ability to upload using the `beforeUpload` option. So the configuration for the limited and restricted
upload might look this way:

```typescript
import createHttpError from "http-errors";

const config = createConfig({
  server: {
    upload: {
      limits: { fileSize: 51200 }, // 50 KB
      limitError: createHttpError(413, "The file is too large"), // handled by errorHandler in config
      beforeUpload: ({ request, logger }) => {
        if (!canUpload(request)) {
          throw createHttpError(403, "Not authorized");
        }
      },
    },
  },
});
```

Then you can change the `Endpoint` to handle requests having the `multipart/form-data` content type instead of JSON by
using `ez.upload()` schema. Together with a corresponding configuration option, this makes it possible to handle file
uploads. Here is a simplified example:

```typescript
import { z } from "zod";
import { ez, defaultEndpointsFactory } from "express-zod-api";

const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.object({
    avatar: ez.upload(), // <--
  }),
  output: z.object({}),
  handler: async ({ input: { avatar } }) => {
    // avatar: {name, mv(), mimetype, data, size, etc}
    // avatar.truncated is true on failure when limitError option is not set
  },
});
```

_You can still send other data and specify additional `input` parameters, including arrays and objects._

## Serving static files

In case you want your server to serve static files, you can use `new ServeStatic()` in `Routing` using the arguments
similar to `express.static()`.
The documentation on these arguments you may find [here](http://expressjs.com/en/4x/api.html#express.static).

```typescript
import { Routing, ServeStatic } from "express-zod-api";
import { join } from "node:path";

const routing: Routing = {
  // path /public serves static files from ./assets
  public: new ServeStatic(join(__dirname, "assets"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};
```

## Connect to your own express app

If you already have your own configured express application, or you find the library settings not enough, you can
connect the endpoints to your app or any express router using the `attachRouting()` method:

```typescript
import express from "express";
import { createConfig, attachRouting, Routing } from "express-zod-api";

const app = express(); // or express.Router()
const config = createConfig({ app /* cors, logger, ... */ });
const routing: Routing = {}; // your endpoints go here

const { notFoundHandler, logger } = attachRouting(config, routing);

app.use(notFoundHandler); // optional
app.listen();
logger.info("Glory to science!");
```

**Please note** that in this case you probably need to parse `request.body`, call `app.listen()` and handle `404`
errors yourself. In this regard `attachRouting()` provides you with `notFoundHandler` which you can optionally connect
to your custom express app.

Besides that, if you're looking to include additional request parsers, or a middleware that establishes its own routes,
then consider using the `beforeRouting` [option in config instead](#using-native-express-middlewares).

## Testing endpoints

The way to test endpoints is to mock the request, response, and logger objects, invoke the `execute()` method, and
assert the expectations for calls of certain mocked methods. The library provides a special method `testEndpoint` that
makes mocking easier. It requires you either to install `jest` (with `@types/jest`) or `vitest`
(detects automatically), or to specify the `fnMethod` property assigned with a function mocking method of your testing
framework, which can also be `node:test` module of most modern Node.js versions.
However, in order to have proper mocking types in your own tests, you also need to specify `MockOverrides` once in your
tests excplicitly, so the tests should look this way:

```typescript
import { testEndpoint } from "express-zod-api";

// place it once anywhere in your tests
declare module "express-zod-api" {
  interface MockOverrides extends jest.Mock {} // or Mock from vitest
}

test("should respond successfully", async () => {
  const { responseMock, loggerMock } = await testEndpoint({
    endpoint: yourEndpoint,
    requestProps: {
      method: "POST", // default: GET
      body: {}, // incoming data as if after parsing (JSON)
    },
    // fnMethod — for testing frameworks other than jest or vitest
    // responseProps, configProps, loggerProps
  });
  expect(loggerMock.error).toHaveBeenCalledTimes(0);
  expect(responseMock.status).toHaveBeenCalledWith(200);
  expect(responseMock.json).toHaveBeenCalledWith({
    status: "success",
    data: {},
  });
});
```

_This method is optimized for the `defaultResultHandler`. With the flexibility to customize, you can add additional
properties as needed._

# Special needs

## Different responses for different status codes

In some special cases you may want the ResultHandler to respond slightly differently depending on the status code,
for example if your API strictly follows REST standards. It may also be necessary to reflect this difference in the
generated Documentation. To implement this functionality, the `createResultHandler` method supports a flexible
declaration of possible response schemas and their corresponding status codes.

```typescript
import { createResultHandler } from "express-zod-api";

createResultHandler({
  getPositiveResponse: (output) => ({
    statusCodes: [201, 202], // created or will be created
    schema: z.object({ status: z.literal("created"), data: output }),
  }),
  getNegativeResponse: () => [
    {
      statusCode: 409, // conflict: entity already exists
      schema: z.object({ status: z.literal("exists"), id: z.number().int() }),
    },
    {
      statusCodes: [400, 500], // validation or internal error
      schema: z.object({ status: z.literal("error"), reason: z.string() }),
    },
  ],
  handler: ({ error, response, output }) => {
    // your implementation here
  },
});
```

## Array response

Please avoid doing this in new projects: responding with array is a bad practice keeping your endpoints from evolving
in backward compatible way (without making breaking changes). Nevertheless, for the purpose of easier migration of
legacy APIs to this library consider using `arrayResultHandler` or `arrayEndpointsFactory` instead of default ones,
or implement your own ones in a similar way.
The `arrayResultHandler` expects your endpoint to have `items` property in the `output` object schema. The array
assigned to that property is used as the response. This approach also supports examples, as well as documentation and
client generation. Check out [the example endpoint](/example/endpoints/list-users.ts) for more details.

## Headers as input source

In a similar way you can enable the inclusion of request headers into the input sources. This is an opt-in feature.
Please note:

- only the custom headers (the ones having `x-` prefix) will be combined into the `input`,
- the request headers acquired that way are lowercase when describing their validation schemas.

```typescript
import { createConfig, defaultEndpointsFactory } from "express-zod-api";
import { z } from "zod";

createConfig({
  inputSources: {
    get: ["query", "headers"],
  }, // ...
});

defaultEndpointsFactory.build({
  method: "get",
  input: z.object({
    "x-request-id": z.string(), // this one is from request.headers
    id: z.string(), // this one is from request.query
  }), // ...
});
```

## Accepting raw data

Some APIs may require an endpoint to be able to accept and process raw data, such as streaming or uploading a binary
file as an entire body of request. Use the proprietary `ez.raw()` schema as the input schema of your endpoint.
The default parser in this case is `express.raw()`. You can customize it by assigning the `rawParser` option in config.
The raw data is placed into `request.body.raw` property, having type `Buffer`.

```typescript
import { defaultEndpointsFactory, ez } from "express-zod-api";

const rawAcceptingEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: ez.raw({
    /* the place for additional inputs, like route params, if needed */
  }),
  output: z.object({ length: z.number().int().nonnegative() }),
  handler: async ({ input: { raw } }) => ({
    length: raw.length, // raw is Buffer
  }),
});
```

## Subscriptions

If you want the user of a client application to be able to subscribe to subsequent updates initiated by the server, the
capabilities of this library and the HTTP protocol itself would not be enough in this case. I have developed an
additional pluggable library, [Zod Sockets](https://github.com/RobinTail/zod-sockets), which has similar principles and
capabilities, but uses the websocket transport and Socket.IO protocol for that purpose. Check out an example of the
synergy between two libraries on handling the incoming `subscribe` and `unsubscribe` events in order to emit
(broadcast) the `time` event every second with a current time in its payload:

https://github.com/RobinTail/zod-sockets#subscriptions

# Integration and Documentation

## Zod Plugin

Express Zod API acts as a plugin for Zod, extending its functionality once you import anything from `express-zod-api`:

- Adds `.example()` method to all Zod schemas for storing examples and reflecting them in the generated documentation;
- Adds `.label()` method to `ZodDefault` for replacing the default value in documentation with a label;
- Alters the `.brand()` method on all Zod schemas by making the assigned brand available in runtime.

## Generating a Frontend Client

You can generate a Typescript file containing the IO types of your API and a client for it.
Consider installing `prettier` and using the async `printFormatted()` method.

```typescript
import { Integration } from "express-zod-api";

const client = new Integration({
  routing,
  variant: "client", // <— optional, see also "types" for a DIY solution
  optionalPropStyle: { withQuestionMark: true, withUndefined: true }, // optional
  splitResponse: false, // optional, prints the positive and negative response types separately
});

const prettierFormattedTypescriptCode = await client.printFormatted(); // or just .print() for unformatted
```

Alternatively, you can supply your own `format` function into that method or use a regular `print()` method instead.
The generated client is flexibly configurable on the frontend side using an implementation function that
directly makes requests to an endpoint using the libraries and methods of your choice.
The client asserts the type of request parameters and response.
Consuming the generated client requires Typescript version 4.1 or higher.

```typescript
// example frontend, simple implementation based on fetch()
import { ExpressZodAPIClient } from "./client.ts"; // the generated file

const client = new ExpressZodAPIClient(async (method, path, params) => {
  const hasBody = !["get", "delete"].includes(method);
  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
  const response = await fetch(`https://example.com${path}${searchParams}`, {
    method: method.toUpperCase(),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(params) : undefined,
  });
  return response.json();
});

client.provide("get", "/v1/user/retrieve", { id: "10" });
client.provide("post", "/v1/user/:id", { id: "10" }); // it also substitues path params
```

## Creating a documentation

You can generate the specification of your API and write it to a `.yaml` file, that can be used as the documentation:

```typescript
import { Documentation } from "express-zod-api";

const yamlString = new Documentation({
  routing, // the same routing and config that you use to start the server
  config,
  version: "1.2.3",
  title: "Example API",
  serverUrl: "https://example.com",
  composition: "inline", // optional, or "components" for keeping schemas in a separate dedicated section using refs
  // descriptions: { positiveResponse, negativeResponse, requestParameter, requestBody } // check out these features
}).getSpecAsYaml();
```

You can add descriptions and examples to your endpoints, their I/O schemas and their properties. It will be included
into the generated documentation of your API. Consider the following example:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const exampleEndpoint = defaultEndpointsFactory.build({
  shortDescription: "Retrieves the user.", // <—— this becomes the summary line
  description: "The detailed explanaition on what this endpoint does.",
  input: z
    .object({
      id: z.number().describe("the ID of the user"),
    })
    .example({
      id: 123,
    }),
  // ..., similarly for output and middlewares
});
```

_See the example of the generated documentation
[here](https://github.com/RobinTail/express-zod-api/blob/master/example/example.documentation.yaml)_

## Tagging the endpoints

When generating documentation, you may find it necessary to classify endpoints into groups. For this, the
possibility of tagging endpoints is provided. In order to achieve the consistency of tags across all endpoints, the
possible tags should be declared in the configuration first and another instantiation approach of the
`EndpointsFactory` is required. Consider the following example:

```typescript
import {
  createConfig,
  EndpointsFactory,
  defaultResultHandler,
} from "express-zod-api";

const config = createConfig({
  // ..., use the simple or the advanced syntax:
  tags: {
    users: "Everything about the users",
    files: {
      description: "Everything about the files processing",
      url: "https://example.com",
    },
  },
});

// instead of defaultEndpointsFactory use the following approach:
const taggedEndpointsFactory = new EndpointsFactory({
  resultHandler: defaultResultHandler, // or use your custom one
  config, // <—— supply your config here
});

const exampleEndpoint = taggedEndpointsFactory.build({
  // ...
  tag: "users", // or tags: ["users", "files"]
});
```

## Customizable brands handling

You can customize handling rules for your schemas in Documentation and Integration. Use the `.brand()` method on your
schema to make it special and distinguishable for the library in runtime. Using symbols is recommended for branding.
After that utilize the `brandHandling` feature of both constructors to declare your custom implementation. In case you
need to reuse a handling rule for multiple brands, use the exposed types `Depicter` and `Producer`.

```ts
import ts from "typescript";
import { z } from "zod";
import {
  Documentation,
  Integration,
  Depicter,
  Producer,
} from "express-zod-api";

const myBrand = Symbol("MamaToldMeImSpecial"); // I recommend to use symbols for this purpose
const myBrandedSchema = z.string().brand(myBrand);

const ruleForDocs: Depicter = (
  schema: typeof myBrandedSchema, // you should assign type yourself
  { next, path, method, isResponse }, // handle a nested schema using next()
) => {
  const defaultDepiction = next(schema.unwrap()); // { type: string }
  return { summary: "Special type of data" };
};

const ruleForClient: Producer = (
  schema: typeof myBrandedSchema, // you should assign type yourself
  { next, isResponse, serializer }, // handle a nested schema using next()
) => ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);

new Documentation({
  /* config, routing, title, version */
  brandHandling: { [myBrand]: ruleForDocs },
});

new Integration({
  /* routing */
  brandHandling: { [myBrand]: ruleForClient },
});
```

# Caveats

There are some well-known issues and limitations, or third party bugs that cannot be fixed in the usual way, but you
should be aware of them.

## Coercive schema of Zod

Despite being supported by the library, `z.coerce.*` schema
[does not work intuitively](https://github.com/RobinTail/express-zod-api/issues/759).
Please be aware that `z.coerce.number()` and `z.number({ coerce: true })` (being typed not well) still will NOT allow
you to assign anything but number. Moreover, coercive schemas are not fail-safe and their methods `.isOptional()` and
`.isNullable()` [are buggy](https://github.com/colinhacks/zod/issues/1911). If possible, try to avoid using this type
of schema. This issue [will NOT be fixed](https://github.com/colinhacks/zod/issues/1760#issuecomment-1407816838) in
Zod version 3.x.

## Excessive properties in endpoint output

The schema validator removes excessive properties by default. However, Typescript
[does not yet display errors](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)
in this case during development. You can achieve this verification by assigning the output schema to a constant and
reusing it in forced type of the output:

```typescript
import { z } from "zod";

const output = z.object({
  anything: z.number(),
});

endpointsFactory.build({
  methods,
  input,
  output,
  handler: async (): Promise<z.input<typeof output>> => ({
    anything: 123,
    excessive: "something", // error TS2322, ok!
  }),
});
```

# Your input to my output

If you have a question or idea, or you found a bug, or vulnerability, or security issue, or want to make a PR:
please refer to [Contributing Guidelines](CONTRIBUTING.md).
