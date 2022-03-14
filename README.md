# Express Zod API

![logo](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/logo.svg)

![CI](https://github.com/RobinTail/express-zod-api/actions/workflows/node.js.yml/badge.svg)
![Swagger Validator](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FRobinTail%2Fexpress-zod-api%2Fmaster%2Fexample%2Fexample.swagger.yaml)
[![coverage](https://coveralls.io/repos/github/RobinTail/express-zod-api/badge.svg)](https://coveralls.io/github/RobinTail/express-zod-api)

![downloads](https://img.shields.io/npm/dw/express-zod-api.svg)
![npm release](https://img.shields.io/npm/v/express-zod-api.svg?color=green25&label=latest)
![GitHub Repo stars](https://img.shields.io/github/stars/RobinTail/express-zod-api.svg)
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
   6. [Start your server](#start-your-server)
   7. [Try it](#try-it)
4. [Fascinating features](#fascinating-features)
   1. [Middlewares](#middlewares)
   2. [Options](#options)
   3. [Refinements](#refinements)
   4. [Transformations](#transformations)
   5. [Dealing with dates](#dealing-with-dates)
   6. [Route path params](#route-path-params)
   7. [Response customization](#response-customization)
   8. [Non-object response](#non-object-response) including file downloads
   9. [Using native express middlewares](#using-native-express-middlewares)
   10. [File uploads](#file-uploads)
   11. [Customizing logger](#customizing-logger)
   12. [Connect to your own express app](#connect-to-your-own-express-app)
   13. [Multiple schemas for one route](#multiple-schemas-for-one-route)
   14. [Serving static files](#serving-static-files)
   15. [Customizing input sources](#customizing-input-sources)
   16. [Enabling compression](#enabling-compression)
   17. [Enabling HTTPS](#enabling-https)
   18. [Informing the frontend about the API](#informing-the-frontend-about-the-api)
   19. [Creating a documentation](#creating-a-documentation)
5. [Additional hints](#additional-hints)
   1. [How to test endpoints](#how-to-test-endpoints)
   2. [Excessive properties in endpoint output](#excessive-properties-in-endpoint-output)
6. [Your input to my output](#your-input-to-my-output)

You can find the release notes in [Changelog](CHANGELOG.md). Along with recommendations for migrating from
[v4](CHANGELOG.md#v500-beta1), [v3](CHANGELOG.md#v400), [v2](CHANGELOG.md#v300-beta1) and [v1](CHANGELOG.md#v200-beta1).

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
- All of your endpoints can respond in a consistent way.
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

```shell
yarn add express-zod-api
# or
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
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    listen: 8090, // port or socket
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
});
```

_See all available options [here](https://github.com/RobinTail/express-zod-api/blob/master/src/config-type.ts)._

## Create an endpoints factory

In the basic case, you can just import and use the default factory:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";
```

_In case you need a global middleware, see [Middlewares](#middlewares)._
_In case you need to customize the response, see [Response customization](#response-customization)._

## Create your first endpoint

```typescript
import { z } from "express-zod-api";

const helloWorldEndpoint = defaultEndpointsFactory.build({
  method: "get",
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

_In case you want it to handle multiple methods use `methods` property instead of `method`._

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

## Start your server

```typescript
import { createServer } from "express-zod-api";

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

```json
{ "status": "success", "data": { "greetings": "Hello, Rick. Happy coding!" } }
```

# Fascinating features

## Middlewares

Middleware can authenticate using input or `request` headers, and can provide endpoint handlers with `options`.
Inputs of middlewares are also available to endpoint handlers within `input`.

Here is an example on how to provide headers of the request.

```typescript
import { createMiddleware } from "express-zod-api";

const headersProviderMiddleware = createMiddleware({
  input: z.object({}), // means no inputs
  middleware: async ({ request }) => ({
    headers: request.headers,
  }),
});
```

By using `.addMiddleware()` method before `.build()` you can connect it to the endpoint:

```typescript
const yourEndpoint = defaultEndpointsFactory
  .addMiddleware(headersProviderMiddleware)
  .build({
    // ...,
    handler: async ({ options }) => {
      // options.headers === request.headers
    },
  });
```

Here is an example of the authentication middleware, that checks a `key` from input and `token` from headers:

```typescript
import { createMiddleware, createHttpError, z } from "express-zod-api";

const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty(),
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

You can connect the middleware to endpoints factory right away, making it kind of global:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const endpointsFactory = defaultEndpointsFactory.addMiddleware(authMiddleware);
```

You can connect as many middlewares as you want, they will be executed in order.

## Options

In case you'd like to provide your endpoints with options that do not depend on Request, like database connection
instance, consider shorthand method `addOptions`.

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const endpointsFactory = defaultEndpointsFactory.addOptions({
  db: mongoose.connect("mongodb://connection.string"),
  privateKey: fs.readFileSync("private-key.pem", "utf-8"),
});
```

## Refinements

By the way, you can implement additional validation within schema.
Validation errors are reported in a response with a status code `400`.

```typescript
import { createMiddleware, z } from "express-zod-api";

const nicknameConstraintMiddleware = createMiddleware({
  input: z.object({
    nickname: z
      .string()
      .nonempty()
      .refine(
        (nick) => !/^\d.*$/.test(nick),
        "Nickname cannot start with a digit"
      ),
  }),
  // ...,
});
```

## Transformations

Since parameters of GET requests come in the form of strings, there is often a need to transform them into numbers or
arrays of numbers.

```typescript
import { z } from "express-zod-api";

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

In order to solve this problem, the library provides two custom methods for dealing with dates: `z.dateIn()` and
`z.dateOut()` for using within input and output schemas accordingly.

`z.dateIn()` is a transforming schema that accepts an ISO `string` representation of a `Date`, validates it, and
provides your endpoint handler or middleware with a `Date`. It supports the following formats:

```text
2021-12-31T23:59:59.000Z
2021-12-31T23:59:59Z
2021-12-31T23:59:59
2021-12-31
```

`z.dateOut()`, on the contrary, accepts a `Date` and provides `ResultHanlder` with a `string` representation in ISO
format for the response transmission. Consider the following simplified example for better understanding:

```typescript
import { z, defaultEndpointsFactory } from "express-zod-api";

const updateUserEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.object({
    userId: z.string(),
    birthday: z.dateIn(), // string -> Date
  }),
  output: z.object({
    createdAt: z.dateOut(), // Date -> string
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

## Route path params

You can describe the route of the endpoint using parameters:

```typescript
import { Routing } from "express-zod-api";

const routing: Routing = {
  v1: {
    user: {
      // route path /v1/user/:id, where :id is the path param
      ":id": getUserEndpoint,
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
import {
  createResultHandler,
  createApiResponse,
  IOSchema,
  markOutput,
  z,
} from "express-zod-api";

export const yourResultHandler = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) =>
    createApiResponse(
      z.object({
        data: markOutput(output),
      }),
      "application/json" // optional, or array of mime types
    ),
  getNegativeResponse: () => createApiResponse(z.object({ error: z.string() })),
  handler: ({ error, input, output, request, response, logger }) => {
    // your implementation
  },
});
```

Then you need to use it as an argument for `EndpointsFactory` instance creation:

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
The response schema generally may be just `z.string()`, but I made more specific `z.file()` that also supports
`.binary()` and `.base64()` refinements which are reflected in the
[generated documentation](#creating-a-documentation).

```typescript
const fileStreamingEndpointsFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => createApiResponse(z.file().binary(), "image/*"),
    getNegativeResponse: () => createApiResponse(z.string(), "text/plain"),
    handler: ({ response, error, output }) => {
      if (error) {
        response.status(400).send(error.message);
        return;
      }
      if ("filename" in output) {
        fs.createReadStream(output.filename).pipe(
          response.type(output.filename)
        );
      } else {
        response.status(400).send("Filename is missing");
      }
    },
  })
);
```

## Using native express middlewares

You can connect any native `express` middleware that can be supplied to `express` method `app.use()`.
For this purpose the `EndpointsFactory` provides method `addExpressMiddleware()` and its alias `use()`.
There are also two optional features available: a provider of options and an error transformer for `ResultHandler`.
In case the error in middleware is not a `HttpError`, the `ResultHandler` will send the status `500`.

```typescript
import { defaultEndpointsFactory, createHttpError } from "express-zod-api";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";

const simpleUsage = defaultEndpointsFactory.addExpressMiddleware(
  cors({ credentials: true })
);

const advancedUsage = defaultEndpointsFactory.use(auth(), {
  provider: (req) => ({ auth: req.auth }), // optional, can be async
  transformer: (err) => createHttpError(401, err.message), // optional
});
```

## File uploads

You can switch the `Endpoint` to handle requests with the `multipart/form-data` content type instead of JSON by using
`z.upload()` schema. Together with a corresponding configuration option, this makes it possible to handle file uploads.
Here is a simplified example:

```typescript
import { createConfig, z, defaultEndpointsFactory } from "express-zod-api";

const config = createConfig({
  server: {
    upload: true, // <- required
    // ...,
  },
});

const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.object({
    avatar: z.upload(), // <--
  }),
  output: z.object({
    /* ... */
  }),
  handler: async ({ input: { avatar } }) => {
    // avatar: {name, mv(), mimetype, data, size, etc}
    // avatar.truncated is true on failure
  },
});
```

_You can still send other data and specify additional `input` parameters, including arrays and objects._

## Customizing logger

You can specify your custom Winston logger in config:

```typescript
import winston from "winston";
import { createConfig } from "express-zod-api";

const logger = winston.createLogger({
  /* ... */
});
const config = createConfig({ logger /* ..., */ });
```

## Connect to your own express app

If you already have your own configured express application, or you find the library settings not enough,
you can connect your routing to the app instead of using `createServer()`.

```typescript
import express from "express";
import { createConfig, attachRouting } from "express-zod-api";

const app = express();
const config = createConfig({ app /* ..., */ });
const routing = {
  /* ... */
};

const { notFoundHandler, logger } = attachRouting(config, routing);

app.use(notFoundHandler); // optional
app.listen();

logger.info("Glory to science!");
```

**Please note** that in this case you probably need to parse `request.body`, call `app.listen()` and handle `404`
errors yourself. In this regard `attachRouting()` provides you with `notFoundHandler` which you can optionally connect
to your custom express app.

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

## Serving static files

In case you want your server to serve static files, you can use `new ServeStatic()` in `Routing` using the arguments
similar to `express.static()`.
The documentation on these arguments you may find [here](http://expressjs.com/en/4x/api.html#express.static).

```typescript
import { Routing, ServeStatic } from "express-zod-api";
import path from "path";

const routing: Routing = {
  // path /public serves static files from ./assets
  public: new ServeStatic(path.join(__dirname, "assets"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};
```

## Customizing input sources

You can customize the list of `request` properties that are combined into `input` that is being validated and available
to your endpoints and middlewares.

```typescript
import { createConfig } from "express-zod-api";

createConfig({
  // ...,
  inputSources: {
    // the default value is:
    get: ["query"],
    post: ["body", "files"],
    put: ["body"],
    patch: ["body"],
    delete: ["query", "body"],
  },
});
```

## Enabling compression

According to [Express JS best practices guide](http://expressjs.com/en/advanced/best-practice-performance.html)
it might be a good idea to enable GZIP compression of your API responses. You can achieve and customize it by using the
corresponding configuration option when using the `createServer()` method.

In order to receive the compressed response the client should include the following header in the request:
`Accept-Encoding: gzip, deflate`. Only responses with compressible content types are subject to compression. There is
also a default threshold of 1KB that can be configured.

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    // compression: true, or:
    compression: {
      // @see https://www.npmjs.com/package/compression#options
      threshold: "100b",
    },
    // ... other options
  },
  // ... other options
});
```

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
    listen: 443, // port or socket
  },
  // ... cors, logger, etc
});

const { app, httpServer, httpsServer, logger } = createServer(config, routing);
```

At least you need to specify the port or socket (usually it is 443), certificate and the key, issued by the
certifying authority. For example, you can acquire a free TLS certificate for your API at
[Let's Encrypt](https://letsencrypt.org/).

## Informing the frontend about the API

You can inform your frontend about the I/O types of your endpoints by exporting them to `.d.ts` files (they only
contain types without any executable code). To achieve that you are going to need an additional `tsconfig.dts.json`
file with the following content:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dts",
    "declaration": true,
    "emitDeclarationOnly": true
  }
}
```

Most likely you have a file with all the configured routing, in which you can do the following:

```typescript
import { EndpointInput, EndpointResponse } from "express-zod-api";

export type YourEndpointInput = EndpointInput<typeof yourEndpoint>;
export type YourEndpointResponse = EndpointResponse<typeof yourEndpoint>;
```

By executing the following command you'll get the compiled `/dts/routing.d.ts` file.

```shell
yarn tsc -p tsconfig.dts.json
```

The command might become a part of your CI/CD.
Then import the I/O type of your endpoint from the compiled file using `import type` syntax on the frontend.

```typescript
import type {
  YourEndpointInput,
  YourEndpointResponse,
} from "../your_backend/dts/routing";
```

## Creating a documentation

You can generate the specification of your API and write it to a `.yaml` file, that can be used as the documentation:

```typescript
import { OpenAPI } from "express-zod-api";

const yamlString = new OpenAPI({
  routing, // the same routing and config that you use to start the server
  config,
  version: "1.2.3",
  title: "Example API",
  serverUrl: "https://example.com",
}).getSpecAsYaml();
```

You can add descriptions and examples to any I/O schema or its properties, and they will be included into the generated
documentation of your API. Consider the following example:

```typescript
import { defaultEndpointsFactory, withMeta } from "express-zod-api";

const exampleEndpoint = defaultEndpointsFactory.build({
  input: withMeta(
    z.object({
      id: z.number().describe("the ID of the user"),
    })
  ).example({
    id: 123,
  }),
  // ..., // similarly for output and middlewares
});
```

_See the example of the generated documentation
[here](https://github.com/RobinTail/express-zod-api/blob/master/example/example.swagger.yaml)_

# Additional hints

## How to test endpoints

The way to test endpoints is to mock the request, response, and logger objects, invoke the `execute()` method, and
assert the expectations for calls of certain mocked methods. The library provides a special method that makes mocking
easier, it requires `jest` (and optionally `@types/jest`) to be installed, so the test might look the following way:

```typescript
import { testEndpoint } from "express-zod-api";

test("should respond successfully", async () => {
  const { responseMock, loggerMock } = await testEndpoint({
    endpoint: yourEndpoint,
    requestProps: {
      method: "POST", // default: GET
      body: { ... },
    },
    // responseProps, configProps, loggerProps
  });
  expect(loggerMock.error).toBeCalledTimes(0);
  expect(responseMock.status).toBeCalledWith(200);
  expect(responseMock.json).toBeCalledWith({
    status: "success",
    data: { ... },
  });
});
```

_This method is optimized for the standard result handler. With the flexibility to customize, you can add additional
properties as needed._

## Excessive properties in endpoint output

The schema validator removes excessive properties by default. However, Typescript
[does not yet display errors](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)
in this case during development. You can achieve this verification by assigning the output schema to a constant and
reusing it in forced type of the output:

```typescript
import { z } from "express-zod-api";

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

Do you have a question or idea?
Your feedback is highly appreciated in [Discussions section](https://github.com/RobinTail/express-zod-api/discussions).

Found a bug?
Please let me know in [Issues section](https://github.com/RobinTail/express-zod-api/issues).

Found a vulnerability or other security issue?
Please refer to [Security policy](https://github.com/RobinTail/express-zod-api/blob/master/SECURITY.md).
