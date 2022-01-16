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
4. [Fascinating features](README-TOO.md#fascinating-features)
   1. [Middlewares](README-TOO.md#middlewares)
   2. [Options](README-TOO.md#options)
   3. [Refinements](README-TOO.md#refinements)
   4. [Transformations](README-TOO.md#transformations)
   5. [Route path params](README-TOO.md#route-path-params)
   6. [Response customization](README-TOO.md#response-customization)
   7. [Non-object response](README-TOO.md#non-object-response) including file downloads
   8. [File uploads](README-TOO.md#file-uploads)
   9. [Customizing logger](README-TOO.md#customizing-logger)
   10. [Connect to your own express app](README-TOO.md#connect-to-your-own-express-app)
   11. [Multiple schemas for one route](README-TOO.md#multiple-schemas-for-one-route)
   12. [Serving static files](README-TOO.md#serving-static-files)
   13. [Customizing input sources](README-TOO.md#customizing-input-sources)
   14. [Enabling compression](README-TOO.md#enabling-compression)
   15. [Enabling HTTPS](README-TOO.md#enabling-https)
   16. [Informing the frontend about the API](README-TOO.md#informing-the-frontend-about-the-api)
   17. [Creating a documentation](README-TOO.md#creating-a-documentation)
5. [Additional hints](README-TOO.md#additional-hints)
   1. [How to test endpoints](README-TOO.md#how-to-test-endpoints)
   2. [Excessive properties in endpoint output](README-TOO.md#excessive-properties-in-endpoint-output)
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

# Features and hints

_Continue reading [here](README-TOO.md)._

# Your input to my output

Do you have a question or idea?
Your feedback is highly appreciated in [Discussions section](https://github.com/RobinTail/express-zod-api/discussions).

Found a bug?
Please let me know in [Issues section](https://github.com/RobinTail/express-zod-api/issues).

Found a vulnerability or other security issue?
Please refer to [Security policy](https://github.com/RobinTail/express-zod-api/blob/master/SECURITY.md).
