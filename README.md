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

1. [Overview](#overview)
2. [How it works](#how-it-works)
3. [Quick start](#quick-start) — **Fast Track**
4. [Basic features](#basic-features)
   1. [Middlewares](#middlewares)
   2. [Options](#options)
   3. [Using native express middlewares](#using-native-express-middlewares)
   4. [Refinements](#refinements)
   5. [Transformations](#transformations)
   6. [Top level transformations and mapping](#top-level-transformations-and-mapping)
   7. [Dealing with dates](#dealing-with-dates)
   8. [Cross-Origin Resource Sharing](#cross-origin-resource-sharing) (CORS)
   9. [Enabling HTTPS](#enabling-https)
   10. [Customizing logger](#customizing-logger)
   11. [Child logger](#child-logger)
   12. [Profiling](#profiling)
   13. [Enabling compression](#enabling-compression)
5. [Advanced features](#advanced-features)
   1. [Customizing input sources](#customizing-input-sources)
   2. [Headers as input source](#headers-as-input-source)
   3. [Nested routes](#nested-routes)
   4. [Route path params](#route-path-params)
   5. [Flat routing syntax](#flat-routing-syntax)
   6. [Multiple schemas for one route](#multiple-schemas-for-one-route)
   7. [Response customization](#response-customization)
   8. [Empty response](#empty-response)
   9. [Error handling](#error-handling)
   10. [Production mode](#production-mode)
   11. [Non-object response](#non-object-response) including file downloads
   12. [HTML Forms (URL encoded)](#html-forms-url-encoded)
   13. [File uploads](#file-uploads)
   14. [Serving static files](#serving-static-files)
   15. [Connect to your own express app](#connect-to-your-own-express-app)
   16. [Testing endpoints](#testing-endpoints)
   17. [Testing middlewares](#testing-middlewares)
6. [Special needs](#special-needs)
   1. [Different responses for different status codes](#different-responses-for-different-status-codes)
   2. [Array response](#array-response) for migrating legacy APIs
   3. [Accepting raw data](#accepting-raw-data)
   4. [Graceful shutdown](#graceful-shutdown)
   5. [Subscriptions](#subscriptions)
7. [Integration and Documentation](#integration-and-documentation)
   1. [Zod Plugin](#zod-plugin)
   2. [Generating a Frontend Client](#generating-a-frontend-client)
   3. [Creating a documentation](#creating-a-documentation)
   4. [Tagging the endpoints](#tagging-the-endpoints)
   5. [Deprecated schemas and routes](#deprecated-schemas-and-routes)
   6. [Customizable brands handling](#customizable-brands-handling)
8. [Caveats](#caveats)
   1. [Coercive schema of Zod](#coercive-schema-of-zod)
   2. [Excessive properties in endpoint output](#excessive-properties-in-endpoint-output)
9. [Your input to my output](#your-input-to-my-output)

You can find the release notes and migration guides in [Changelog](CHANGELOG.md).

# Overview

I made this framework because of the often repetitive tasks of starting a web server APIs with the need to validate input
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

## Contributors

These people contributed to the improvement of the framework by reporting bugs, making changes and suggesting ideas:

[<img src="https://github.com/williamgcampbell.png" alt="@williamgcampbell" width="50px" />](https://github.com/williamgcampbell)
[<img src="https://github.com/gmorgen1.png" alt="@gmorgen1" width="50px" />](https://github.com/gmorgen1)
[<img src="https://github.com/crgeary.png" alt="@crgeary" width="50px" />](https://github.com/crgeary)
[<img src="https://github.com/danmichaelo.png" alt="@danmichaelo" width="50px" />](https://github.com/danmichaelo)
[<img src="https://github.com/james10424.png" alt="@james10424" width="50px" />](https://github.com/james10424)
[<img src="https://github.com/APTy.png" alt="@APTy" width="50px" />](https://github.com/APTy)
[<img src="https://github.com/LufyCZ.png" alt="@LufyCZ" width="50px" />](https://github.com/LufyCZ)
[<img src="https://github.com/mlms13.png" alt="@mlms13" width="50px" />](https://github.com/mlms13)
[<img src="https://github.com/bobgubko.png" alt="@bobgubko" width="50px" />](https://github.com/bobgubko)
[<img src="https://github.com/LucWag.png" alt="@LucWag" width="50px" />](https://github.com/LucWag)
[<img src="https://github.com/HenriJ.png" alt="@HenriJ" width="50px" />](https://github.com/HenriJ)
[<img src="https://github.com/JonParton.png" alt="@JonParton" width="50px" />](https://github.com/JonParton)
[<img src="https://github.com/t1nky.png" alt="@t1nky" width="50px" />](https://github.com/t1nky)
[<img src="https://github.com/Tomtec331.png" alt="@Tomtec331" width="50px" />](https://github.com/Tomtec331)
[<img src="https://github.com/rottmann.png" alt="@rottmann" width="50px" />](https://github.com/rottmann)
[<img src="https://github.com/boarush.png" alt="@boarush" width="50px" />](https://github.com/boarush)
[<img src="https://github.com/shawncarr.png" alt="@shawncarr" width="50px" />](https://github.com/shawncarr)
[<img src="https://github.com/ben-xD.png" alt="@ben-xD" width="50px" />](https://github.com/ben-xD)
[<img src="https://github.com/daniel-white.png" alt="@daniel-white" width="50px" />](https://github.com/daniel-white)
[<img src="https://github.com/kotsmile.png" alt="@kotsmile" width="50px" />](https://github.com/kotsmile)
[<img src="https://github.com/arlyon.png" alt="@arlyon" width="50px" />](https://github.com/arlyon)
[<img src="https://github.com/elee1766.png" alt="@elee1766" width="50px" />](https://github.com/elee1766)
[<img src="https://github.com/danclaytondev.png" alt="@danclaytondev" width="50px" />](https://github.com/danclaytondev)
[<img src="https://github.com/huyhoang160593.png" alt="@huyhoang160593" width="50px" />](https://github.com/huyhoang160593)
[<img src="https://github.com/sarahssharkey.png" alt="@sarahssharkey" width="50px" />](https://github.com/sarahssharkey)
[<img src="https://github.com/master-chu.png" alt="@master-chu" width="50px" />](https://github.com/master-chu)
[<img src="https://github.com/alindsay55661.png" alt="@alindsay55661" width="50px" />](https://github.com/alindsay55661)
[<img src="https://github.com/john-schmitz.png" alt="@john-schmitz" width="50px" />](https://github.com/john-schmitz)
[<img src="https://github.com/miki725.png" alt="@miki725" width="50px" />](https://github.com/miki725)
[<img src="https://github.com/dev-m1-macbook.png" alt="@dev-m1-macbook" width="50px" />](https://github.com/dev-m1-macbook)
[<img src="https://github.com/McMerph.png" alt="@McMerph" width="50px" />](https://github.com/McMerph)
[<img src="https://github.com/niklashigi.png" alt="@niklashigi" width="50px" />](https://github.com/niklashigi)
[<img src="https://github.com/maxcohn.png" alt="@maxcohn" width="50px" />](https://github.com/maxcohn)
[<img src="https://github.com/VideoSystemsTech.png" alt="@VideoSystemsTech" width="50px" />](https://github.com/VideoSystemsTech)
[<img src="https://github.com/TheWisestOne.png" alt="@TheWisestOne" width="50px" />](https://github.com/TheWisestOne)
[<img src="https://github.com/lazylace37.png" alt="@lazylace37" width="50px" />](https://github.com/lazylace37)
[<img src="https://github.com/leosuncin.png" alt="@leosuncin" width="50px" />](https://github.com/leosuncin)
[<img src="https://github.com/kirdk.png" alt="@kirdk" width="50px" />](https://github.com/kirdk)
[<img src="https://github.com/johngeorgewright.png" alt="@johngeorgewright" width="50px" />](https://github.com/johngeorgewright)
[<img src="https://github.com/ssteuteville.png" alt="@ssteuteville" width="50px" />](https://github.com/ssteuteville)
[<img src="https://github.com/foxfirecodes.png" alt="@foxfirecodes" width="50px" />](https://github.com/foxfirecodes)
[<img src="https://github.com/HardCoreQual.png" alt="@HardCoreQual" width="50px" />](https://github.com/HardCoreQual)
[<img src="https://github.com/hellovai.png" alt="@hellovai" width="50px" />](https://github.com/hellovai)
[<img src="https://github.com/Isaac-Leonard.png" alt="@Isaac-Leonard" width="50px" />](https://github.com/Isaac-Leonard)
[<img src="https://github.com/digimuza.png" alt="@digimuza" width="50px" />](https://github.com/digimuza)
[<img src="https://github.com/glitch452.png" alt="@glitch452" width="50px" />](https://github.com/glitch452)

# How it works

## Concept

The API operates object schemas for input and output validation.
The object being validated is the combination of certain `request` properties.
It is available to the endpoint handler as the `input` parameter.
Middlewares have access to all `request` properties, they can provide endpoints with `options`.
The object returned by the endpoint handler is called `output`. It goes to the `ResultHandler` which is
responsible for transmitting consistent responses containing the `output` or possible error.
Much can be customized to fit your needs.

![Dataflow](https://raw.githubusercontent.com/RobinTail/express-zod-api/master/dataflow.svg)

## Technologies

- [Typescript](https://www.typescriptlang.org/) first.
- Web server — [Express.js](https://expressjs.com/) v5.
- Schema validation — [Zod 3.x](https://github.com/colinhacks/zod) including [Zod Plugin](#zod-plugin).
- Supports any logger having `info()`, `debug()`, `error()` and `warn()` methods;
  - Built-in console logger with colorful and pretty inspections by default.
- Generators:
  - Documentation — [OpenAPI 3.1](https://github.com/metadevpro/openapi3-ts) (former Swagger);
  - Client side types — inspired by [zod-to-ts](https://github.com/sachinraja/zod-to-ts).
- File uploads — [Express-FileUpload](https://github.com/richardgirges/express-fileupload)
  (based on [Busboy](https://github.com/mscdex/busboy)).

# Quick start

## Installation

Install the framework, its peer dependencies and type assistance packages using your favorite
[package manager](https://nodesource.com/blog/nodejs-package-manager-comparative-guide-2024/).

```shell
# example for yarn:
yarn add express-zod-api express zod@3 typescript http-errors
yarn add -D @types/express @types/node @types/http-errors
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
[in sources](https://github.com/RobinTail/express-zod-api/blob/master/express-zod-api/src/config-type.ts)._

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  http: {
    listen: 8090, // port, UNIX socket or options
  },
  cors: true,
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
  // method: "get" (default) or array ["get", "post", ...]
  input: z.object({
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
import { Middleware } from "express-zod-api";

const authMiddleware = new Middleware({
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
  handler: async ({ input: { key }, request, logger }) => {
    logger.debug("Checking the key and token");
    const user = await db.Users.findOne({ key });
    if (!user) throw createHttpError(401, "Invalid key");
    if (request.headers.token !== user.token)
      throw createHttpError(401, "Invalid token");
    return { user }; // provides endpoints with options.user
  },
});
```

By using `.addMiddleware()` method before `.build()` you can connect it to the endpoint:

```typescript
const yourEndpoint = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .build({
    handler: async ({ options: { user } }) => {
      // user is the one returned by authMiddleware
    }, // ...
  });
```

You can create a new factory by connecting as many middlewares as you want — they will be executed in the specified
order for all the endpoints produced on that factory. You may also use a shorter inline syntax within the
`.addMiddleware()` method, and have access to the output of the previously executed middlewares in chain as `options`:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const factory = defaultEndpointsFactory
  .addMiddleware(authMiddleware) // add Middleware instance or use shorter syntax:
  .addMiddleware({
    handler: async ({ options: { user } }) => ({}), // user from authMiddleware
  });
```

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
import { ResultHandler } from "express-zod-api";

const resultHandlerWithCleanup = new ResultHandler({
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
being an additional request parser (like `cookie-parser`), use the `beforeRouting` option. However, it might be better
to avoid `cors` here — [the framework handles it on its own](#cross-origin-resource-sharing).

```typescript
import { createConfig } from "express-zod-api";
import ui from "swagger-ui-express";

const config = createConfig({
  beforeRouting: ({ app, getLogger }) => {
    const logger = getLogger();
    logger.info("Serving the API documentation at https://example.com/docs");
    app.use("/docs", ui.serve, ui.setup(documentation));
    app.use("/custom", (req, res, next) => {
      const childLogger = getLogger(req); // if childLoggerProvider is configured
    });
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
import { Middleware } from "express-zod-api";

const nicknameConstraintMiddleware = new Middleware({
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
  input: z.object({
    id: z.string().transform((id) => parseInt(id, 10)),
    ids: z
      .string()
      .transform((ids) => ids.split(",").map((id) => parseInt(id, 10))),
  }),
  handler: async ({ input: { id, ids }, logger }) => {
    logger.debug("id", id); // type: number
    logger.debug("ids", ids); // type: number[]
  },
});
```

## Top level transformations and mapping

For some APIs it may be important that public interfaces such as query parameters use snake case, while the
implementation itself requires camel case for internal naming. In order to facilitate interoperability between the
different naming standards you can `.transform()` the entire `input` schema into another object using a well-typed
mapping library, such as [camelize-ts](https://www.npmjs.com/package/camelize-ts). However, that approach would not be
enough for the `output` schema if you're also aiming to [generate a valid documentation](#creating-a-documentation),
because the transformations themselves do not contain schemas. Addressing this case, the framework offers the `.remap()`
method of the object schema, a part of the [Zod plugin](#zod-plugin), which under the hood, in addition to the
transformation, also `.pipe()` the transformed object into a new object schema.
Here is a recommended solution: it is important to use shallow transformations only.

```ts
import camelize from "camelize-ts";
import snakify from "snakify-ts";
import { z } from "zod";

const endpoint = endpointsFactory.build({
  input: z
    .object({ user_id: z.string() })
    .transform((inputs) => camelize(inputs, /* shallow: */ true)),
  output: z
    .object({ userName: z.string() })
    .remap((outputs) => snakify(outputs, /* shallow: */ true)),
  handler: async ({ input: { userId }, logger }) => {
    logger.debug("user_id became userId", userId);
    return { userName: "Agneta" }; // becomes "user_name" in response
  },
});
```

The `.remap()` method can also accept an object with an explicitly defined naming of your choice. The original keys
missing in that object remain unchanged (partial mapping).

```ts
z.object({ user_name: z.string(), id: z.number() }).remap({
  user_name: "weHAVEreallyWEIRDnamingSTANDARDS", // "id" remains intact
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

In order to solve this problem, the framework provides two custom methods for dealing with dates: `ez.dateIn()` and
`ez.dateOut()` for using within input and output schemas accordingly.

`ez.dateIn()` is a transforming schema that accepts an ISO `string` representation of a `Date`, validates it, and
provides your endpoint handler or middleware with a `Date`. It supports the following formats:

```text
2021-12-31T23:59:59.000Z
2021-12-31T23:59:59Z
2021-12-31T23:59:59
2021-12-31
```

`ez.dateOut()`, on the contrary, accepts a `Date` and provides `ResultHandler` with a `string` representation in ISO
format for the response transmission. Consider the following simplified example for better understanding:

```typescript
import { z } from "zod";
import { ez, defaultEndpointsFactory } from "express-zod-api";

const updateUserEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.object({
    userId: z.string(),
    birthday: ez.dateIn(), // string -> Date in handler
  }),
  output: z.object({
    createdAt: ez.dateOut(), // Date -> string in response
  }),
  handler: async ({ input }) => ({
    createdAt: new Date("2022-01-22"), // 2022-01-22T00:00:00.000Z
  }),
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
often called an SSL certificate in habit. This way you can additionally (or solely) configure and run the HTTPS server:

```typescript
import { createConfig, createServer } from "express-zod-api";

const config = createConfig({
  https: {
    options: {
      cert: fs.readFileSync("fullchain.pem", "utf-8"),
      key: fs.readFileSync("privkey.pem", "utf-8"),
    },
    listen: 443, // port, UNIX socket or options
  }, // ... cors, logger, etc
});

// 'await' is only needed if you're going to use the returned entities.
// For top level CJS you can wrap you code with (async () => { ... })()
const { app, servers, logger } = await createServer(config, routing);
```

Ensure having `@types/node` package installed. At least you need to specify the port (usually it is 443) or UNIX socket,
certificate and the key, issued by the certifying authority. For example, you can acquire a free TLS certificate for
your API at [Let's Encrypt](https://letsencrypt.org/).

## Customizing logger

A simple built-in console logger is used by default with the following options that you can configure:

```typescript
import { createConfig } from "express-zod-api";
const config = createConfig({
  logger: {
    level: "debug", // or "warn" in production mode
    color: undefined, // detects automatically, boolean
    depth: 2, // controls how deeply entities should be inspected
  },
});
```

You can also replace it with a one having at least the following methods: `info()`, `debug()`, `error()` and `warn()`.
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
You can use the `.child()` method of the built-in logger or [install a custom logger](#customizing-logger) instead.

```typescript
import { createConfig, BuiltinLogger } from "express-zod-api";
import { randomUUID } from "node:crypto";

// This enables the .child() method on "logger":
declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}

const config = createConfig({
  childLoggerProvider: ({ parent, request }) =>
    parent.child({ requestId: randomUUID() }), // accessible at logger.ctx.requestId later
});
```

## Profiling

For debugging and performance testing purposes the framework offers a simple `.profile()` method on the built-in logger.
It starts a timer when you call it and measures the duration in adaptive units (from picoseconds to minutes) until you
invoke the returned callback. The default severity of those measurements is `debug`.

```typescript
import { createConfig, BuiltinLogger } from "express-zod-api";

// This enables the .profile() method on built-in logger:
declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}

// Inside a handler of Endpoint, Middleware or ResultHandler:
const done = logger.profile("expensive operation");
doExpensiveOperation();
done(); // debug: expensive operation '555 milliseconds'
```

You can also customize the profiler with your own formatter, chosen severity or even performance assessment function:

```typescript
logger.profile({
  message: "expensive operation",
  severity: (ms) => (ms > 500 ? "error" : "info"), // assess immediately
  formatter: (ms) => `${ms.toFixed(2)}ms`, // custom format
});
doExpensiveOperation();
done(); // error: expensive operation '555.55ms'
```

## Enabling compression

According to [Express.js best practices guide](http://expressjs.com/en/advanced/best-practice-performance.html)
it might be a good idea to enable GZIP and Brotli compression for your API responses.

Install `compression` and `@types/compression`, and enable or configure compression:

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  /** @link https://www.npmjs.com/package/compression#options */
  compression: { threshold: "1kb" }, // or true
});
```

In order to receive a compressed response the client should include the following header in the request:
`Accept-Encoding: br, gzip, deflate`. Only responses with compressible content types are subject to compression.

# Advanced features

## Customizing input sources

You can customize the list of `request` properties that are combined into `input` that is being validated and available
to your endpoints and middlewares. The order here matters: each next item in the array has a higher priority than its
previous sibling. The following arrangement is default:

```typescript
import { createConfig } from "express-zod-api";

createConfig({
  inputSources: {
    get: ["query", "params"],
    post: ["body", "params", "files"],
    put: ["body", "params"],
    patch: ["body", "params"],
    delete: ["query", "params"],
  }, // ...
});
```

## Headers as input source

In a similar way you can enable request headers as the input source. This is an opt-in feature. Please note:

- consider giving `headers` the lowest priority among other `inputSources` to avoid overwrites;
- consider handling headers in `Middleware` and declaring them within `security` property to improve `Documentation`;
- the request headers acquired that way are always lowercase when describing their validation schemas.

```typescript
import { createConfig, Middleware } from "express-zod-api";
import { z } from "zod";

createConfig({
  inputSources: {
    get: ["headers", "query"], // headers have lowest priority
  }, // ...
});

new Middleware({
  security: { type: "header", name: "token" }, // recommended
  input: z.object({ token: z.string() }),
});

factory.build({
  input: z.object({
    "x-request-id": z.string(), // this one is from request.headers
    id: z.string(), // this one is from request.query
  }), // ...
});
```

## Nested routes

Suppose you want to assign both `/v1/path` and `/v1/path/subpath` routes with Endpoints:

```typescript
import { Routing } from "express-zod-api";

const routing: Routing = {
  v1: {
    path: endpointA.nest({
      subpath: endpointB,
    }),
  },
};
```

## Route path params

You can assign your Endpoint to a route like `/v1/user/:id` where `:id` is the path parameter:

```typescript
import { Routing } from "express-zod-api";

const routing: Routing = {
  v1: {
    user: { ":id": getUserEndpoint },
  },
};
```

You then need to specify these parameters in the endpoint input schema in the usual way:

```typescript
const getUserEndpoint = endpointsFactory.build({
  input: z.object({
    id: z.string().transform(Number), // path params are always strings
  }), // ...
});
```

## Flat routing syntax

Alternatively, a flat routing syntax is also supported. Mixing syntaxes for nesting is allowed. Properties with
assigned endpoints can explicitly declare a method.

```ts
import { Routing } from "express-zod-api";

const routing: Routing = {
  "/v1/user/:id": getUserEndpoint,
  v1: {
    "delete /user/:id": deleteUserEndpoint,
  },
};
```

## Multiple schemas for one route

Thanks to the `DependsOnMethod` class a route may have multiple Endpoints attached depending on different methods.
It can also be the same Endpoint that handles multiple methods as well. The `method` property can be omitted for
`EndpointsFactory::build()` so that the method determination would be delegated to the `Routing`.

```typescript
import { DependsOnMethod, Routing } from "express-zod-api";

// the route /v1/user has two Endpoints
// which handle a couple of methods each
const routing: Routing = {
  v1: {
    user: new DependsOnMethod({
      get: endpointA,
      delete: endpointA,
      post: endpointB,
      patch: endpointB,
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
  | { status: "success"; data: OUT } // Positive response
  | { status: "error"; error: { message: string } }; // or Negative response
```

You can create your own result handler by using this example as a template:

```typescript
import { z } from "zod";
import {
  ResultHandler,
  ensureHttpError,
  getMessageFromError,
} from "express-zod-api";

const yourResultHandler = new ResultHandler({
  positive: (data) => ({
    schema: z.object({ data }),
    mimeType: "application/json", // optinal or array
  }),
  negative: z.object({ error: z.string() }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (error) {
      const { statusCode } = ensureHttpError(error);
      const message = getMessageFromError(error);
      return void response.status(statusCode).json({ error: message });
    }
    response.status(200).json({ data: output });
  },
});
```

_See also [Different responses for different status codes](#different-responses-for-different-status-codes)_.

After creating your custom `ResultHandler` you can use it as an argument for `EndpointsFactory` instance creation:

```typescript
import { EndpointsFactory } from "express-zod-api";

const endpointsFactory = new EndpointsFactory(yourResultHandler);
```

## Empty response

For some REST APIs, empty responses are typical: with status code `204` (No Content) and redirects (302). In order to
describe it set the `mimeType` to `null` and `schema` to `z.never()`:

```typescript
const resultHandler = new ResultHandler({
  positive: { statusCode: 204, mimeType: null, schema: z.never() },
  negative: { statusCode: 404, mimeType: null, schema: z.never() },
});
```

## Error handling

All runtime errors are handled by a `ResultHandler`. The default is `defaultResultHandler`. Using `ensureHttpError()`
it normalizes errors into consistent HTTP responses with sensible status codes. Errors can originate from three layers:

- `Endpoint` execution (including attached `Middleware`):
  - Handled by a `ResultHandler` used by `EndpointsFactory` (`defaultEndpointsFactory` uses `defaultResultHandler`);
  - `InputValidationError`: request violates `input` schema, the default status code is `400`;
  - `OutputValidationError`: handler violates `output` schema, the default status code is `500`;
  - `HttpError`: can be thrown in handlers with help of `createHttpError()`, its `.statusCode` is used for response;
  - For other errors the default status code is `500`;
- Routing, parsing and upload issues:
  - Handled by `ResultHandler` configured as `errorHandler` (the defaults is `defaultResultHandler`);
  - Parsing errors: passed through as-is (typically `HttpError` with `4XX` code used for response by default);
  - Routing errors: `404` or `405`, based on `wrongMethodBehavior` configuration;
  - Upload issues: thrown only if `upload.limitError` is configured (`HttpError::statusCode` can be used for response);
  - For other errors the default status code is `500`;
- `ResultHandler` failures:
  - Handled by `LastResortHandler` with status code `500` and a plain text response.

You can customize it by passing a custom `ResultHandler` to `EndpointsFactory` and by configuring `errorHandler`.

## Production mode

Consider enabling production mode by setting `NODE_ENV` environment variable to `production` for your deployment:

- Express activates some [performance optimizations](https://expressjs.com/en/advanced/best-practice-performance.html);
- Self-diagnosis for potential problems is disabled to ensure faster startup;
- The `defaultResultHandler`, `defaultEndpointsFactory` and `LastResortHandler` generalize server-side error messages
  in negative responses in order to improve the security of your API by not disclosing the exact causes of errors:
  - Throwing errors that have or imply `5XX` status codes become just `Internal Server Error` message in response;
  - You can control that behavior by throwing errors using `createHttpError()` and using its `expose` option:

```ts
import createHttpError from "http-errors";
// NODE_ENV=production
// Throwing HttpError from Endpoint or Middleware that is using defaultResultHandler or defaultEndpointsFactory:
createHttpError(401, "Token expired"); // —> "Token expired"
createHttpError(401, "Token expired", { expose: false }); // —> "Unauthorized"
createHttpError(500, "Something is broken"); // —> "Internal Server Error"
createHttpError(501, "We didn't make it yet", { expose: true }); // —> "We didn't make it yet"
```

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
  new ResultHandler({
    positive: { schema: ez.file("buffer"), mimeType: "image/*" },
    negative: { schema: z.string(), mimeType: "text/plain" },
    handler: ({ response, error, output }) => {
      if (error) return void response.status(400).send(error.message);
      if ("filename" in output)
        fs.createReadStream(output.filename).pipe(
          response.type(output.filename),
        );
      else response.status(400).send("Filename is missing");
    },
  }),
);
```

## HTML Forms (URL encoded)

Use the proprietary schema `ez.form()` with an object shape or a custom `z.object()` with form fields in order to
describe the `input` schema of an Endpoint. Requests to the Endpoint are parsed using the `formParser` config option,
which is `express.urlencoded()` by default. The request content type should be `application/x-www-form-urlencoded`
(default for HTML forms without uploads).

```ts
import { defaultEndpointsFactory, ez } from "express-zod-api";
import { z } from "zod";

export const submitFeedbackEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: ez.form({
    name: z.string().min(1),
    email: z.string().email(),
    message: z.string().min(1),
  }),
});
```

_Hint: for unlisted extra fields use the following syntax: `ez.form( z.object({}).passthrough() )`._

## File uploads

Install the following additional packages: `express-fileupload` and `@types/express-fileupload`, and enable or
configure file uploads. Refer to [documentation](https://www.npmjs.com/package/express-fileupload#available-options) on
available options. The `limitHandler` option is replaced by the `limitError` one. You can also connect an additional
middleware for restricting the ability to upload using the `beforeUpload` option. So the configuration for the limited
and restricted upload might look this way:

```typescript
import createHttpError from "http-errors";

const config = createConfig({
  upload: /* true or options: */ {
    limits: { fileSize: 51200 }, // 50 KB
    limitError: createHttpError(413, "The file is too large"), // handled by errorHandler in config
    beforeUpload: ({ request, logger }) => {
      if (!canUpload(request)) throw createHttpError(403, "Not authorized");
    },
    debug: true, // default
  },
});
```

Then use `ez.upload()` schema for a corresponding property. The request content type must be `multipart/form-data`:

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

If you already have your own configured express application, or you find the framework settings not enough, you can
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
assert the expectations on status, headers and payload. The framework provides a special method `testEndpoint` that
makes mocking easier. Under the hood, request and response object are mocked using the
[node-mocks-http](https://www.npmjs.com/package/node-mocks-http) library, therefore you can utilize its API for
settings additional properties and asserting expectation using the provided getters, such as `._getStatusCode()`.

```typescript
import { testEndpoint } from "express-zod-api";

test("should respond successfully", async () => {
  const { responseMock, loggerMock } = await testEndpoint({
    endpoint: yourEndpoint,
    requestProps: {
      method: "POST", // default: GET
      body: {}, // incoming data as if after parsing (JSON)
    }, // responseOptions, configProps, loggerProps
  });
  expect(loggerMock._getLogs().error).toHaveLength(0);
  expect(responseMock._getStatusCode()).toBe(200);
  expect(responseMock._getHeaders()).toHaveProperty("x-custom", "one"); // lower case!
  expect(responseMock._getJSONData()).toEqual({ status: "success" });
});
```

## Testing middlewares

Middlewares can also be tested individually using the `testMiddleware()` method. You can also pass `options` collected
from outputs of previous middlewares, if the one being tested somehow depends on them. Possible errors would be handled
either by `errorHandler` configured within given `configProps` or `defaultResultHandler`.

```typescript
import { z } from "zod";
import { Middleware, testMiddleware } from "express-zod-api";

const middleware = new Middleware({
  input: z.object({ test: z.string() }),
  handler: async ({ options, input: { test } }) => ({
    collectedOptions: Object.keys(options),
    testLength: test.length,
  }),
});

const { output, responseMock, loggerMock } = await testMiddleware({
  middleware,
  requestProps: { method: "POST", body: { test: "something" } },
  options: { prev: "accumulated" }, // responseOptions, configProps, loggerProps
});
expect(loggerMock._getLogs().error).toHaveLength(0);
expect(output).toEqual({ collectedOptions: ["prev"], testLength: 9 });
```

# Special needs

## Different responses for different status codes

In some special cases you may want the ResultHandler to respond slightly differently depending on the status code,
for example if your API strictly follows REST standards. It may also be necessary to reflect this difference in the
generated Documentation. For that purpose, the constructor of `ResultHandler` accepts flexible declaration of possible
response schemas and their corresponding status codes.

```typescript
import { ResultHandler } from "express-zod-api";

new ResultHandler({
  positive: (data) => ({
    statusCode: [201, 202], // created or will be created
    schema: z.object({ status: z.literal("created"), data }),
  }),
  negative: [
    {
      statusCode: 409, // conflict: entity already exists
      schema: z.object({ status: z.literal("exists"), id: z.number().int() }),
    },
    {
      statusCode: [400, 500], // validation or internal error
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
legacy APIs to this framework consider using `arrayResultHandler` or `arrayEndpointsFactory` instead of default ones,
or implement your own ones in a similar way.
The `arrayResultHandler` expects your endpoint to have `items` property in the `output` object schema. The array
assigned to that property is used as the response. This approach also supports examples, as well as documentation and
client generation. Check out [the example endpoint](/example/endpoints/list-users.ts) for more details.

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

## Graceful shutdown

You can enable and configure a special request monitoring that, if it receives a signal to terminate a process, will
first put the server into a mode that rejects new requests, attempt to complete started requests within the specified
time, and then forcefully stop the server and terminate the process.

```ts
import { createConfig } from "express-zod-api";

createConfig({
  gracefulShutdown: {
    timeout: 1000,
    events: ["SIGINT", "SIGTERM"],
  },
});
```

## Subscriptions

If you want the user of a client application to be able to subscribe to subsequent updates initiated by the server,
consider [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) (SSE) feature.
Client application can subscribe to the event stream using `EventSource` class instance or the
[instance of the generated](#generating-a-frontend-client) `Subscription` class. The following example demonstrates
the implementation emitting the `time` event each second.

```typescript
import { z } from "zod";
import { EventStreamFactory } from "express-zod-api";
import { setTimeout } from "node:timers/promises";

const subscriptionEndpoint = EventStreamFactory({
  time: z.number().int().positive(),
}).buildVoid({
  input: z.object({}), // optional input schema
  handler: async ({ options: { emit, isClosed } }) => {
    while (!isClosed()) {
      emit("time", Date.now());
      await setTimeout(1000);
    }
  },
});
```

If you need more capabilities, such as bidirectional event sending, I have developed an additional websocket operating
framework, [Zod Sockets](https://github.com/RobinTail/zod-sockets), which has similar principles and capabilities.

# Integration and Documentation

## Zod Plugin

Express Zod API acts as a plugin for Zod, extending its functionality once you import anything from `express-zod-api`:

- Adds `.example()` method to all Zod schemas for storing examples and reflecting them in the generated documentation;
- Adds `.deprecated()` method to all schemas for marking properties and request parameters as deprecated;
- Adds `.label()` method to `ZodDefault` for replacing the default value in documentation with a label;
- Adds `.remap()` method to `ZodObject` for renaming object properties in a suitable way for making documentation;
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
});

const prettierFormattedTypescriptCode = await client.printFormatted(); // or just .print() for unformatted
```

Alternatively, you can supply your own `format` function into that method or use a regular `print()` method instead.
The generated client is flexibly configurable on the frontend side for using a custom implementation function that
makes requests using the libraries and methods of your choice. The default implementation uses `fetch`. The client
asserts the type of request parameters and response. Consuming the generated client requires Typescript version 4.1+.

```typescript
import { Client, Implementation, Subscription } from "./client.ts"; // the generated file

const client = new Client(/* optional custom Implementation */);
client.provide("get /v1/user/retrieve", { id: "10" });
client.provide("post /v1/user/:id", { id: "10" }); // it also substitues path params
new Subscription("get /v1/events/stream", {}).on("time", (time) => {}); // Server-sent events (SSE)
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
  // descriptions: { positiveResponse, negativeResponse, requestParameter, requestBody }, // check out these features
  // numericRange: null, // to disable printing min/max values for z.number() based on JS engine limits
}).getSpecAsYaml();
```

You can add descriptions and examples to your endpoints, their I/O schemas and their properties. It will be included
into the generated documentation of your API. Consider the following example:

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const exampleEndpoint = defaultEndpointsFactory.build({
  shortDescription: "Retrieves the user.", // <—— this becomes the summary line
  description: "The detailed explanaition on what this endpoint does.",
  input: z.object({
    id: z.number().describe("the ID of the user").example(123),
  }),
  // ..., similarly for output and middlewares
});
```

_See the example of the generated documentation
[here](https://github.com/RobinTail/express-zod-api/blob/master/example/example.documentation.yaml)_

## Tagging the endpoints

When generating documentation, you may find it necessary to classify endpoints into groups. The possibility of tagging
endpoints is available for that purpose. In order to establish the constraints on tags across all the endpoints, they
should be declared as keys of `TagOverrides` interface. Consider the following example:

```typescript
import { defaultEndpointsFactory, Documentation } from "express-zod-api";

// Add similar declaration once, somewhere in your code, preferably near config
declare module "express-zod-api" {
  interface TagOverrides {
    users: unknown;
    files: unknown;
    subscriptions: unknown;
  }
}

// Use the declared tags for endpoints
const exampleEndpoint = defaultEndpointsFactory.build({
  tag: "users", // or array ["users", "files"]
});

// Add extended description of the tags to Documentation (optional)
new Documentation({
  tags: {
    users: "All about users",
    files: { description: "All about files", url: "https://example.com" },
  },
});
```

## Deprecated schemas and routes

As your API evolves, you may need to mark some parameters or routes as deprecated before deleting them. For this
purpose, the `.deprecated()` method is available on each schema, `Endpoint` and `DependsOnMethod`, it's immutable.
You can also deprecate all routes the `Endpoint` assigned to by setting `EndpointsFactory::build({ deprecated: true })`.

```ts
import { Routing, DependsOnMethod } from "express-zod-api";
import { z } from "zod";

const someEndpoint = factory.build({
  deprecated: true, // deprecates all routes the endpoint assigned to
  input: z.object({
    prop: z.string().deprecated(), // deprecates the property or a path parameter
  }),
});

const routing: Routing = {
  v1: oldEndpoint.deprecated(), // deprecates the /v1 path
  v2: new DependsOnMethod({ get: oldEndpoint }).deprecated(), // deprecates the /v2 path
  v3: someEndpoint, // the path is assigned with initially deprecated endpoint (also deprecated)
};
```

## Customizable brands handling

You can customize handling rules for your schemas in Documentation and Integration. Use the `.brand()` method on your
schema to make it special and distinguishable for the framework in runtime. Using symbols is recommended for branding.
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
  { next, isResponse }, // handle a nested schema using next()
) => ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);

new Documentation({
  brandHandling: { [myBrand]: ruleForDocs },
});

new Integration({
  brandHandling: { [myBrand]: ruleForClient },
});
```

# Caveats

There are some well-known issues and limitations, or third party bugs that cannot be fixed in the usual way, but you
should be aware of them.

## Coercive schema of Zod

Despite being supported by the framework, `z.coerce.*` schema
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
