# Changelog

## Version 23

### v23.0.0

- Minimum version of `compression` (optional peer dependency) is `1.8.0` (it supports Brotli);
- The default value for `wrongMethodBehavior` config option is changed to `405`;
- Publicly exposed interfaces: `CustomHeaderSecurity` —> `HeaderSecurity`, `NormalizedResponse` removed.
- Only the following methods remained public, while other methods and properties were marked internal or removed:
  - `Endpoint`: `.execute()` and `.deprecated()`;
  - `Middleware`: `.execute()`;
  - `ResultHandler`: `.execute()`;
  - `DependsOnMethod`: `.deprecated()`
  - `Documentation`: constructor only;
  - `Integration`: `.print()` and `.printFormatted()`;
  - `ServeStatic`: constructor only.

## Version 22

### v22.11.1

- Simplified the type of `requestMock` returned from `testEndpoint` and `testMiddleware`.

### v22.11.0

- Featuring an ability to configure the numeric range of the generated Documentation:
  - The new property `numericRange` on the `Documentation::constructor()` argument provides the way to specify
    acceptable limits of `z.number()` and `z.number().int()` that your API can handle;
  - Possible values: `{ integer: [number, number], float: [number, number] } | null`;
  - Those numbers are used to depict min/max values for `z.number()` schema without limiting refinements;
  - The default value is the limits of the JavaScript engine:
    - for integers: `[ Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER ]`;
    - for floats: `[ -Number.MAX_VALUE, Number.MAX_VALUE ]`;
  - The `null` value disables the feature (no min/max values printed unless defined explicitly by the schema);
    - This can be useful when a third party tool is having issues to process the generated Documentation;
    - Such an issue was reported by [@APTy](https://github.com/APTy) for the Java-based tool:
      [openapi-generator](https://github.com/OpenAPITools/openapi-generator);
  - Examples of representation of numerical schemes depending on this setting:

```yaml
- schema: z.number()
  numericRange: undefined
  depicted:
    type: number
    format: double
    minimum: -1.7976931348623157e+308 # -Number.MAX_VALUE
    maximum: 1.7976931348623157e+308 # Number.MAX_VALUE
- schema: z.number()
  numericRange: null
  depicted:
    type: number
    format: double
- schema: z.number().int()
  numericRange: undefined
  depicted:
    type: integer
    format: int64
    minimum: -9007199254740991 # Number.MIN_SAFE_INTEGER
    maximum: 9007199254740991 # Number.MAX_SAFE_INTEGER
- schema: z.number().int()
  numericRange: null
  depicted:
    type: integer
    format: int64
- schema: z.number().int().nonnegative().max(100)
  numericRange: undefined
  depicted:
    type: integer
    format: int64
    exclusiveMinimum: 0 # explicitly defined by .nonnegative()
    maximum: 100 # explicitly defined by .max()
```

### v22.10.1

- Fixed catching errors in a custom `ResultHandler` used as `errorHandler` for Not Found routes having async `handler`.

```ts
// reproduction
import { createConfig, ResultHandler } from "express-zod-api";

createConfig({
  errorHandler: new ResultHandler({
    // rejected promise was not awaited:
    handler: async () => {
      throw new Error(
        "You should not do it. But if you do, we've got LastResortHandler to catch it.",
      );
    },
  }),
});
```

### v22.10.0

- Featuring required request bodies in the generated Documentation:
  - This version sets the `required` property to `requestBody` when:
    - It contains the required properties on it;
    - Or it's based on `ez.raw()` (proprietary schema);
  - The presence of `requestBody` depends on the Endpoint method(s) and the configuration of `inputSources`;
  - The lack of the property was reported by [@LufyCZ](https://github.com/LufyCZ).

### v22.9.1

- Minor refactoring and optimizations.

### v22.9.0

- Featuring Deprecations:
  - You can deprecate all usage of an `Endpoint` using `EndpointsFactory::build({ deprecated: true })`;
  - You can deprecate a route using the assigned `Endpoint::deprecated()` or `DependsOnMethod::deprecated()`;
  - You can deprecate a schema using `ZodType::deprecated()`;
  - All `.deprecated()` methods are immutable — they create a new copy of the subject;
  - Deprecated schemas and endpoints are reflected in the generated `Documentation` and `Integration`;
  - The feature suggested by [@mlms13](https://github.com/mlms13).

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

### v22.8.0

- Feature: warning about the endpoint input scheme ignoring the parameters of the route to which it is assigned:
  - There is a technological gap between routing and endpoints, which at the same time allows an endpoint to be reused
    across multiple routes. Therefore, there are no constraints between the route parameters and the `input` schema;
  - This version introduces checking for such discrepancies:
    - non-use of the path parameter or,
    - a mistake in manually entering its name;
  - The warning is displayed when the application is launched and NOT in production mode.

```ts
const updateUserEndpoint = factory.build({
  method: "patch",
  input: z.object({
    id: z.string(), // implies path parameter "id"
  }),
});

const routing: Routing = {
  v1: {
    user: {
      ":username": updateUserEndpoint, // path parameter is "username" instead of "id"
    },
  },
};
```

```shell
warn: The input schema of the endpoint is most likely missing the parameter of the path it is assigned to.
      { method: 'patch', path: '/v1/user/:username', param: 'username' }
```

### v22.7.0

- Technical release in connection with the implementation of workspaces into the project architecture.

### v22.6.0

- Feature: pulling examples up from the object schema properties:
  - When describing I/O schemas for generating `Documentation` the examples used to work properly only when assigned to
    the top level (`z.object().example()`), especially complex scenarios involving path parameters and middlewares;
  - This version supports examples assigned to the individual properties on the I/O object schemas;
  - It makes the syntax more readable and fixes the issue when example is only set for a path parameter.

```ts
const before = factory.build({
  input: z
    .object({
      key: z.string(),
    })
    .example({
      key: "1234-5678-90",
    }),
});

const after = factory.build({
  input: z.object({
    key: z.string().example("1234-5678-90"),
  }),
});
```

### v22.5.0

- Feature: `defaultResultHandler` sets headers from `HttpError`:
  - If you `throw createHttpError(400, "message", { headers })` those `headers` go to the negative response.
- Feature: Ability to respond with status code `405` (Method not allowed) to requests having wrong method:
  - Previously, in all cases where the method and route combination was not defined, the response had status code `404`;
  - For situations where a known route does not support the method being used, there is a more appropriate code `405`:
    - See https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405 for details;
  - You can activate this feature by setting the new `wrongMethodBehavior` config option `405` (default: `404`).

```ts
import { createConfig } from "express-zod-api";

createConfig({ wrongMethodBehavior: 405 });
```

### v22.4.2

- Excluded 41 response-only headers from the list of well-known ones used to depict request params in Documentation.

### v22.4.1

- Fixed a bug that could lead to duplicate properties in generated client types:
  - If the middleware and/or endpoint schemas had the same property, it was duplicated by Integration.
  - The issue was introduced in [v20.15.3](#v20153) and reported by [@bobgubko](https://github.com/bobgubko).

```ts
// reproduction
factory
  .addMiddleware({
    input: z.object({ query: z.string() }), // ...
  })
  .build({
    input: z.object({ query: z.string() }), // ...
  });
```

```ts
type Before = {
  query: string;
  query: string; // <— bug #2352
};
type After = {
  query: string;
};
```

### v22.4.0

- Feat: ability to supply extra data to a custom implementation of the generated client:
  - You can instantiate the client class with an implementation accepting an optional context of your choice;
  - The public `.provide()` method can now accept an additional argument having the type of that context;
  - The problem on missing such ability was reported by [@LucWag](https://github.com/LucWag).

```ts
import { Client, Implementation } from "./generated-client.ts";

interface MyCtx {
  extraKey: string;
}

const implementation: Implementation<MyCtx> = async (
  method,
  path,
  params,
  ctx, // ctx is optional MyCtx
) => {};

const client = new Client(implementation);

client.provide("get /v1/user/retrieve", { id: "10" }, { extraKey: "123456" });
```

### v22.3.1

- Fixed issue on emitting server-sent events (SSE), introduced in v21.5.0:
  - Emitting SSE failed due to internal error `flush is not a function` having `compression` disabled in config;
  - The `.flush()` method of `response` is a feature of `compression` (optional peer dependency);
  - It is required to call the method when `compression` is enabled;
  - This version fixes the issue by calling the method conditionally;
  - This bug was reported by [@bobgubko](https://github.com/bobgubko).

### v22.3.0

- Feat: `Subscription` class for consuming Server-sent events:
  - The `Integration` can now also generate a frontend helper class `Subscription` to ease SSE support;
  - The new class establishes an `EventSource` instance and exposes it as the public `source` property;
  - The class also provides the public `on` method for your typed listeners;
  - You can configure the generated class name using `subscriptionClassName` option (default: `Subscription`);
  - The feature is only applicable to the `variant` option set to `client` (default).

```ts
import { Subscription } from "./client.ts"; // the generated file

new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
```

### v22.2.0

- Feat: detecting headers from `Middleware::security` declarations:
  - When `headers` are enabled within `inputSources` of config, the `Documentation` generator can now identify them
    among other inputs additionally by using the security declarations of middlewares attached to an `Endpoint`;
  - This approach enables handling of custom headers without `x-` prefix.

```ts
const authMiddleware = new Middleware({
  security: { type: "header", name: "token" },
});
```

### v22.1.1

- This version contains an important technical simplification of routines related to processing of `security`
  declarations of the used `Middleware` when generating API `Documentation`.
  - No changes to the operation are expected. This refactoring is required for a feature that will be released later.

### v22.1.0

- Feat: ability to configure the generated client class name:
  - New option `clientClassName` for `Integration::constructor()` argument, default: `Client`.
- Feat: default implementation for the generated client:
  - The argument of the generated client class constructor became optional;
  - The `Implementation` previously suggested as an example (using `fetch`) became the one used by default;
  - You may no longer need to write the implementation if the default one suits your needs.

```ts
import { Integration } from "express-zod-api";
new Integration({ clientClassName: "FancyClient" });
```

```ts
import { FancyClient } from "./generated-client.ts";
const client = new FancyClient(/* optional implementation */);
```

### v22.0.0

- Minimum supported Node versions: 20.9.0 and 22.0.0:
  - Node 18 is no longer supported; its end of life is April 30, 2025.
- `BuiltinLogger::profile()` behavior changed for picoseconds: expressing them through nanoseconds;
- Feature: handling all (not just `x-` prefixed) headers as an input source (when enabled):
  - Behavior changed for `headers` inside `inputSources` config option: all headers are addressed to the `input` object;
  - This change is motivated by the deprecation of `x-` prefixed headers;
  - Since the order inside `inputSources` matters, consider moving `headers` to the first place to avoid overwrites;
  - The generated `Documentation` recognizes both `x-` prefixed inputs and well-known headers listed on IANA.ORG;
  - You can customize that behavior by using the new option `isHeader` of the `Documentation::constructor()`.
- The `splitResponse` property on the `Integration::constructor()` argument is removed;
- Changes to the client code generated by `Integration`:
  - The class name changed from `ExpressZodAPIClient` to just `Client`;
  - The overload of the `Client::provide()` having 3 arguments and the `Provider` type are removed;
  - The public `jsonEndpoints` const is removed — use the `content-type` header of an actual response instead;
  - The public type `MethodPath` is removed — use the `Request` type instead.
- The approach to tagging endpoints changed:
  - The `tags` property moved from the argument of `createConfig()` to `Documentation::constructor()`;
  - The overload of `EndpointsFactory::constructor()` accepting `config` property is removed;
  - The argument of `EventStreamFactory::constructor()` is now the events map (formerly assigned to `events` property);
  - Tags should be declared as the keys of the augmented interface `TagOverrides` instead;
- The public method `Endpoint::getSecurity()` now returns an array;
- Consider the automated migration using the built-in ESLint rule.

```js
// eslint.config.mjs — minimal ESLint 9 config to apply migrations automatically using "eslint --fix"
import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v22": "error" } },
];
```

```diff
  createConfig({
-   tags: {},
    inputSources: {
-     get: ["query", "headers"] // if you have headers on last place
+     get: ["headers", "query"] // move headers to avoid overwrites
    }
  });

  new Documentation({
+   tags: {},
+   isHeader: (name, method, path) => {} // optional
  });

  new EndpointsFactory(
-   { config, resultHandler: new ResultHandler() }
+   new ResultHandler()
  );

  new EventStreamFactory(
-   { config, events: {} }
+   {} // events map only
  );
```

```ts
// new tagging approach
import { defaultEndpointsFactory, Documentation } from "express-zod-api";

// Add similar declaration once, somewhere in your code, preferably near config
declare module "express-zod-api" {
  interface TagOverrides {
    users: unknown;
    files: unknown;
    subscriptions: unknown;
  }
}

// Add extended description of the tags to Documentation (optional)
new Documentation({
  tags: {
    users: "All about users",
    files: { description: "All about files", url: "https://example.com" },
  },
});
```

## Version 21

### v21.11.1

- Common styling methods (coloring) are extracted from the built-in logger instance:
  - This measure is to reduce memory consumption when using a child logger.

### v21.11.0

- New public property `ctx` is available on instances of `BuiltinLogger`:
  - When using the built-in logger and `childLoggerProvider` config option, the `ctx` property contains the argument
    that was used for creating the child logger using its `.child()` method;
  - It can be utilized for accessing its `requestId` property for purposes other than logging;
  - The default value of `ctx` is an empty object (when the instance is not a child logger).

```ts
import { BuiltinLogger, createConfig, createMiddleware } from "express-zod-api";

// Declaring the logger type in use
declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}

// Configuring child logger provider
const config = createConfig({
  childLoggerProvider: ({ parent }) =>
    parent.child({ requestId: randomUUID() }),
});

// Accessing child logger context
createMiddleware({
  handler: async ({ logger }) => {
    doSomething(logger.ctx.requestId); // <—
  },
});
```

### v21.10.0

- New `Integration` option: `serverUrl`, string, optional, the API URL for the generated client:
  - Currently used for generating example implementation;
  - Default value remains `https://example.com`;
- Using `new URL()` for constructing the final request URL in the example implementation of the generated client:
  - That enables handling `serverUrl` both with and without trailing slash;

### v21.9.0

- Deprecating `MethodPath` type in the code generated by `Integration`:
  - Introducing the `Request` type to be used instead;
- Added JSDoc having the request in description for every type and interface generated by `Integration`;
- A couple adjustments for consistency and performance.

### v21.8.0

- Deprecating `jsonEndpoints` from the code generated by `Integration`:
  - Use the `content-type` header of an actual response instead, [example](#v20212).

### v21.7.0

- Feature: introducing `EncodedResponse` public interface in the code generated by `Integration`:
  - The new entity should enable making custom clients having response type awereness based on the status code;
  - The difference between `Response` and `EndcodedResponse` is the second hierarchical level.

```ts
import { EncodedResponse } from "./generated.ts";

type UsageExample = EncodedResponse["get /v1/user/retrieve"][200];
```

### v21.6.1

- `node-mocks-http` version is `^1.16.2`;
- Fixed possible duplicates in the `Path` type generated by `Integration`:
  - Duplicates used to be possible when using `DependsOnMethod` instance within specified `routing`.

### v21.6.0

- Supporting the following `z.string()` formats by the `Documentation` generator:
  - `base64` (as `byte`), `date`, `time`, `duration`, `nanoid`;
  - And new formats introduced by Zod 3.24: `jwt`, `base64url`, `cidr`;
- Fixed missing `minLength` and `maxLength` properties when depicting `z.string().length()` (fixed length strings).

### v21.5.0

- Feat: Introducing [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events):
  - Basic implementation of the event streams feature is now available using `EventStreamFactory` class;
  - The new factory is similar to `EndpointsFactory` including the middlewares support;
  - Client application can subscribe to the event stream using `EventSource` class instance;
  - `Documentation` and `Integration` do not have yet a special depiction of such endpoints;
  - This feature is a lightweight alternative to [Zod Sockets](https://github.com/RobinTail/zod-sockets).

```ts
import { z } from "zod";
import { EventStreamFactory } from "express-zod-api";
import { setTimeout } from "node:timers/promises";

const subscriptionEndpoint = EventStreamFactory({
  events: { time: z.number().int().positive() },
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

```js
const source = new EventSource("https://example.com/api/v1/time");
source.addEventListener("time", (event) => {
  const data = JSON.parse(event.data); // number
});
```

### v21.4.0

- Return type of public methods `getTags()` and `getScopes()` of `Endpoint` corrected to `ReadyonlyArray<string>`;
- Featuring `EndpointsFactory::buildVoid()` method:
  - It's a shorthand for returning `{}` while having `output` schema `z.object({})`;
  - When using this method, `handler` may return `void` while retaining the object-based operation internally.

```diff
- factory.build({
+ factory.buildVoid({
-   output: z.object({}),
    handler: async () => {
-     return {};
    },
  });
```

### v21.3.0

- Fixed `provide()` method usage example in the code of the generated client;
- Always splitting the response in the generated client:
  - This will print the positive and negative response types separately;
  - The `splitResponse` property on the `Integration` class constructor argument is deprecated.

### v21.2.0

- Minor performance adjustments;
- Introducing stricter overload for the generated `ExpressZodAPIClient::provide()` method:
  - The method can now also accept two arguments: space-separated method with path and parameters;
  - Using this overload provides strict constraints on the first argument so that undeclared routes can not be used;
  - This design is inspired by the OctoKit and aims to prevent the misuse by throwing a Typescript error.
- Using `ExpressZodAPIClient::provide()` with three arguments is deprecated:
  - The return type when using undeclared routes corrected to `unknown`.
- The `Provider` type of the generated client is deprecated;
- The type of the following generated client entities is corrected so that it became limited to the listed routes:
  - `Input`, `Response`, `PositiveResponse`, `NegativeResponse`, `MethodPath`.

```diff
- client.provide("get", "/v1/user/retrieve", { id: "10" }); // deprecated
+ client.provide("get /v1/user/retrieve", { id: "10" }); // featured
```

### v21.1.0

- Featuring empty response support:
  - For some REST APIs, empty responses are typical: with status code `204` (No Content) and redirects (302);
  - Previously, the framework did not offer a straightforward way to describe such responses, but now there is one;
  - The `mimeType` property can now be assigned with `null` in `ResultHandler` definition;
  - Both `Documentation` and `Integration` generators ignore such entries so that the `schema` can be `z.never()`:
    - The body of such response will not be depicted by `Documentation`;
    - The type of such response will be described as `undefined` (configurable) by `Integration`.

```ts
import { z } from "zod";
import {
  ResultHandler,
  ensureHttpError,
  EndpointsFactory,
  Integration,
} from "express-zod-api";

const resultHandler = new ResultHandler({
  positive: { statusCode: 204, mimeType: null, schema: z.never() },
  negative: { statusCode: 404, mimeType: null, schema: z.never() },
  handler: ({ error, response }) => {
    response.status(error ? ensureHttpError(error).statusCode : 204).end(); // no content
  },
});

new Integration({ noContent: z.undefined() }); // undefined is default
```

### v21.0.0

- Minimum supported versions of `express`: 4.21.1 and 5.0.1 (fixed vulnerabilities);
- Breaking changes to `createConfig()` argument:
  - The `server` property renamed to `http` and made optional — (can now configure HTTPS only);
  - These properties moved to the top level: `jsonParser`, `upload`, `compression`, `rawParser` and `beforeRouting`;
  - Both `logger` and `getChildLogger` arguments of `beforeRouting` function are replaced with all-purpose `getLogger`.
- Breaking changes to `createServer()` resolved return:
  - Both `httpServer` and `httpsServer` are combined into single `servers` property (array, same order).
- Breaking changes to `EndpointsFactory::build()` argument:
  - Plural `methods`, `tags` and `scopes` properties replaced with singular `method`, `tag`, `scope` accordingly;
  - The `method` property also made optional and can now be derived from `DependsOnMethod` or imply `GET` by default;
  - When `method` is assigned with an array, it must be non-empty.
- Breaking changes to `positive` and `negative` properties of `ResultHandler` constructor argument:
  - Plural `statusCodes` and `mimeTypes` props within the values are replaced with singular `statusCode` and `mimeType`.
- Other breaking changes:
  - The `serializer` property of `Documentation` and `Integration` constructor argument removed;
  - The `originalError` property of `InputValidationError` and `OutputValidationError` removed (use `cause` instead);
  - The `getStatusCodeFromError()` method removed (use the `ensureHttpError().statusCode` instead);
  - The `testEndpoint()` method can no longer test CORS headers — that function moved to `Routing` traverse;
  - For `Endpoint`: `getMethods()` may return `undefined`, `getMimeTypes()` removed, `getSchema()` variants reduced;
  - Public properties `pairs`, `firstEndpoint` and `siblingMethods` of `DependsOnMethod` replaced with `entries`.
- Consider the automated migration using the built-in ESLint rule.

```js
// eslint.config.mjs — minimal ESLint 9 config to apply migrations automatically using "eslint --fix"
import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v21": "error" } },
];
```

```ts
// The sample of new structure
const config = createConfig({
  http: { listen: 80 }, // became optional
  https: { listen: 443, options: {} },
  upload: true,
  compression: true,
  beforeRouting: ({ app, getLogger }) => {
    const logger = getLogger();
    app.use((req, res, next) => {
      const childLogger = getLogger(req);
    });
  },
});
const { servers } = await createServer(config, {});
```

## Version 20

### v20.22.1

- Avoids startup logo distortion when the terminal is too narrow;
- Self-diagnosis for potential problems disabled in production mode to ensure faster startup:
  - Warning about potentially unserializable schema for JSON operating endpoints was introduced in v20.15.0.

### v20.22.0

- Featuring a helper to describe nested Routing for already assigned routes:
  - Suppose you want to describe `Routing` for both `/v1/path` and `/v1/path/subpath` routes having Endpoints attached;
  - Previously, an empty path segment was proposed for that purpose, but there is more elegant and readable way now;
  - The `.nest()` method is available both on `Endpoint` and `DependsOnMethod` instances:

```ts
import { Routing } from "express-zod-api";

// Describing routes /v1/path and /v1/path/subpath both having endpoints assigned:
const before: Routing = {
  v1: {
    path: {
      "": endpointA,
      subpath: endpointB,
    },
  },
};

const after: Routing = {
  v1: {
    path: endpointA.nest({
      subpath: endpointB,
    }),
  },
};
```

### v20.21.2

- Fixed the example implementation in the generated client for endpoints using path params:
  - The choice of parser was made based on the exported `const jsonEndpoints` indexed by `path`;
  - The actual `path` used for the lookup already contained parameter substitutions so that JSON parser didn't work;
  - The new example implementation suggests choosing the parser based on the actual `response.headers`;
  - The issue was found and reported by [@HenriJ](https://github.com/HenriJ).

```diff
- const parser = `${method} ${path}` in jsonEndpoints ? "json" : "text";
+ const isJSON = response.headers
+   .get("content-type")
+   ?.startsWith("application/json");
- return response[parser]();
+ return response[isJSON ? "json" : "text"]();
```

### v20.21.1

- Performance tuning: `Routing` traverse made about 12 times faster.

### v20.21.0

- Feat: input schema made optional:
  - The `input` property can be now omitted on the argument of the following methods:
    `Middlware::constructor`, `EndpointsFactory::build()`, `EndpointsFactory::addMiddleware()`;
  - When the input schema is not specified `z.object({})` is used;
  - This feature aims to simplify the implementation for Endpoints and Middlwares having no inputs.

### v20.20.1

- Minor code style refactoring and performance tuning;
- The software is redefined as a framework;
  - Thanks to [@JonParton](https://github.com/JonParton) for contribution to the documentation.

### v20.20.0

- Introducing `errorHandler` option for `testMiddleware()` method:
  - If your middleware throws an error there was no ability to make assertions other than the thrown error;
  - New option can be assigned with a function for transforming the error into response, so that `testMiddlware` itself
    would not throw, enabling usage of all returned entities for mutiple assertions in test;
  - The feature suggested by [@williamgcampbell](https://github.com/williamgcampbell).

```ts
import { testMiddleware, Middleware } from "express-zod-api";

const middlware = new Middleware({
  input: z.object({}),
  handler: async ({ logger }) => {
    logger.info("logging something");
    throw new Error("something went wrong");
  },
});

test("a middleware throws, but it writes log as well", async () => {
  const { loggerMock, responseMock } = await testMiddleware({
    errorHandler: (error, response) => response.end(error.message),
    middleware,
  });
  expect(loggerMock._getLogs().info).toEqual([["logging something"]]);
  expect(responseMock._getData()).toBe("something went wrong");
});
```

### v20.19.0

- Configuring built-in logger made optional:
  - Built-in logger configuration option `level` made optional as well as the `logger` option for `createConfig()`;
  - Using `debug` level by default, or `warn` when `NODE_ENV=production`.
- Fixed performance issue on `BuiltinLogger` when its `color` option is not set in config:
  - `.child()` method is 50x times faster now by only detecting the color support once;
  - Color autodetection was introduced in v18.3.0.

### v20.18.0

- Introducing `ensureHttpError()` method that converts any `Error` into `HttpError`:
  - It converts `InputValidationError` to `BadRequest` (status code `400`) and others to `InternalServerError` (`500`).
- Deprecating `getStatusCodeFromError()` — use the `ensureHttpError().statusCode` instead.
- Generalizing server-side error messages in production mode by default:
  - This feature aims to improve the security of your API by not disclosing the exact causes of errors;
  - Applies to `defaultResultHandler`, `defaultEndpointsFactory` and Last Resort Handler only;
  - When `NODE_ENV` is set to `production` (displayed on startup);
  - Instead of actual message the default one associated with the corresponding `statusCode` used;
  - Server-side errors are those having status code `5XX`, or treated that way by `ensureHttpError()`;
  - You can control that behavior by throwing errors using `createHttpError()` and using its `expose` option;
  - More about production mode and how to activate it:
    https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production

```ts
import createHttpError from "http-errors";
// NODE_ENV=production
// Throwing HttpError from Endpoint or Middleware that is using defaultResultHandler or defaultEndpointsFactory:
createHttpError(401, "Token expired"); // —> "Token expired"
createHttpError(401, "Token expired", { expose: false }); // —> "Unauthorized"
createHttpError(500, "Something is broken"); // —> "Internal Server Error"
createHttpError(501, "We didn't make it yet", { expose: true }); // —> "We didn't make it yet"
```

### v20.17.0

- Added `cause` property to `DocumentationError`;
- Log all server side errors (status codes `>= 500`) and in full (not just the `message`).

### v20.16.0

- Deprecating `originalError` property on both `InputValidationError` and `OutputValidationError`:
  - Use `cause` property instead;
  - Those error classes are publicly exposed for developers making custom Result Handlers.

```diff
  const error = new InputValidationError(new z.ZodError([]));
- logger.error(error.originalError.message);
+ logger.error(error.cause.message);
```

### v20.15.3

- Merge intersected object types in generated client:
  - This fixes "empty object" intersection problem for endpoints having middlwares without inputs.

```diff
- type GetV1UserRetrieveInput = {} & {
+ type GetV1UserRetrieveInput = {
    /** a numeric string containing the id of the user */
    id: string;
  };
```

### v20.15.2

- Fixed duplicated client types in unions:
  - When `splitResponse` option is disabled on `Integration` primitive response types could have been duplicated.

```diff
- type GetV1AvatarSendResponse = string | string;
+ type GetV1AvatarSendResponse = string;
```

### v20.15.1

- Deprecating `serializer` property on `Documentation` and `Integration` constructor argument:
  - That property was introduced in v9.3.0 and utilized for comparing schemas in order to handle possible circular
    references within `z.lazy()`;
  - The property is no longer in use and will be removed in version 21.

### v20.15.0

- Feat: warn about potentially unserializable schema used for JSON operating endpoints:
  - This version will warn you if you're using a schema that might not work in request or response, in particular:
    - Generally unserializable objects: `z.map()`, `z.set()`, `z.bigint()`;
    - JSON incompatible entities: `z.never()`, `z.void()`, `z.promise()`, `z.symbol()`, `z.nan()`;
    - Non-revivable in request: `z.date()`;
    - Incorrectly used in request: `ez.dateOut()`;
    - Incorrectly used in response: `ez.dateIn()`, `ez.upload()`, `ez.raw()`;
  - The feature suggested by [@t1nky](https://github.com/t1nky).

### v20.14.3

- Fixed: missing export of `testMiddleware`:
  - The feature introduced in v20.4.0 but was not available;
  - The issue reported by [@Tomtec331](https://github.com/Tomtec331).

### v20.14.2

- Documentation: promoting Express 5 as the recommended version for new projects;
- Minor refactoring: response variant constraints, inverted definition of `AbstractLogger` type;
- There is now an opportunity to support the project with sponsorship: https://github.com/sponsors/RobinTail

### v20.14.1

- `node-mocks-http` version is `^1.16.1`:
  - This deduplicates the `@types/express` dependency to the version installed in your project;
  - This fix is an addition to the support of Express 5 (v20.10.0) and its types (v20.14.0).

### v20.14.0

- Enabling usage of recently released `@types/express@^5.0.0`:
  - This is an addition to the support of Express 5 introduced in v20.10.0.

### v20.12.0

- Feat: Graceful Shutdown
  - You can enable and configure a special request monitoring that,
    if it receives a signal to terminate a process, will:
    - first put the server into a mode that rejects new requests,
    - attempt to complete started requests within the specified time,
    - and then forcefully stop the server and terminate the process;
  - This feature utilizes a modernized fork of [http-terminator](https://github.com/gajus/http-terminator).

```ts
import { createConfig } from "express-zod-api";

createConfig({
  gracefulShutdown: {
    timeout: 1000,
    events: ["SIGINT", "SIGTERM"],
  },
});
```

### v20.11.0

- Feat: Handling deprecation events by actual logger
  - `express` uses `depd` for emitting `deprecation` events when a certain deprecated approach used;
  - This version installs a listener of that event and delegates it to the `warn` method of your actual logger.

### v20.10.0

- Feat: Supporting Express 5
  - Epic news: after 10 years of struggles and anticipations
    [Express 5.0.0 is finally released](https://github.com/expressjs/express/releases/tag/v5.0.0);
  - The primary a mostly awaited feature is the proper support of asynchronous handlers;
  - This version introduces the initial support of Express 5 without breaking changes;
  - Notice: the corresponding `@types/express` for the version 5 is not yet released;
  - [Instructions on migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html).

### v20.9.2

- Minor syntax adjustments and cleanup;
- `node-mocks-http` version is 1.16.0.

### v20.9.1

- Plain text MIME type is set for the corresponding responses:
  - Last Resort Handler (in case your ResultHandler throws);
  - ~~`arrayResultHandler`~~ (deprecated) — in case of errors and failures.

### v20.9.0

- `openapi3-ts` version is 4.4.0:
  - Feat: `Documentation::getSpecAsYaml()` accepts the same options as `yaml.stringify`.

### v20.8.0

- Feat: providing child logger to `beforeRouting()` hook:
  - The function assigned to config property `server.beforeRouting` now accepts additional argument `getChildLogger()`;
  - The featured method accepts `request` and returns a child logger if `childLoggerProvider()` is configured;
  - Otherwise, it returns the root logger (same for all requests, same as the `logger` argument);
  - The feature suggested by [@williamgcampbell](https://github.com/williamgcampbell).

```ts
import { createConfig } from "express-zod-api";
import { randomUUID } from "node:crypto";

const config = createConfig({
  logger: { level: "debug" },
  childLoggerProvider: ({ parent }) =>
    parent.child({ requestId: randomUUID() }),
  server: {
    listen: 80,
    beforeRouting: ({ app, logger, getChildLogger }) => {
      logger.info("This is root logger");
      app.use((req, res, next) => {
        getChildLogger(req).info("This is a child logger");
        next();
      });
    },
  },
});
```

### v20.7.1

- Improved documentation on error handling:
  - More clarity on the origins of possible runtime errors and how they are handled by default;
  - Revealing details on how routing, parsing and upload errors are handled by default;
  - Correction to the JSDoc of the corresponding `errorHandler` property in config.
- Removing redundant type coercion in the migration tool.

### v20.7.0

- Changes to migration plugin (single-use tool, regardless SemVer):
  - Requirements: `eslint@^9` and `typescript-eslint@^8` (may work with previous versions, but it's no longer tested);
  - The `express-zod-api/migration` is a pure ESLint plugin: no rule applied by default, it must be enabled explicitly;
  - The files requiring migration have to be defined explicitly — this should improve clarity on its operation;
  - The ESLint plugin was introduced in v20.0.0 for automated migration from v19 (except assertions in tests);
  - For migrating from v19 use the following minimal config and run `eslint --fix`:

```javascript
// eslint.config.js (or .mjs if you're developing in a CommonJS environment)
import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  {
    files: ["**/*.ts"], // define the files need to be migrated (source code)
    rules: { "migration/v20": "error" }, // enable the rule explicitly
  },
];
```

### v20.6.2

- Small refactoring of several methods and expressions.

### v20.6.1

- `node-mocks-http` version `^1.15.1`.

### v20.6.0

- Small performance tuning;
- Featuring customizations for profiler of the built-in logger:
  - The `.profile()` method can now accept an object having the following properties:
    - `message` — the one to be displayed;
    - `formatter` — optional, a function to transform milliseconds into a string or number;
    - `severity` — optional, `debug` (default), `info`, `warn`, `error`:
      - it can also be a function returning one of those values depending on duration in milliseconds;
      - thus, you can immediately assess the measured performance.

```typescript
const done = logger.profile({
  message: "expensive operation",
  severity: (ms) => (ms > 500 ? "error" : "info"),
  formatter: (ms) => `${ms.toFixed(2)}ms`,
});
doExpensiveOperation();
done(); // error: expensive operation '555.55ms'
```

### v20.5.0

- Featuring a simple profiler for the built-in logger:
  - Introducing `BuiltinLogger::profile(msg: string)` — measures the duration until you invoke the returned callback;
  - Using Node Performance Hooks for measuring microtimes (less than 1ms);
  - The output severity is `debug` (will be customizable later), so logger must have the corresponding `level`;
  - It prints the duration in log using adaptive units: from picoseconds to minutes.

```typescript
// usage assuming that logger is an instance of BuiltinLogger
const done = logger.profile("expensive operation");
doExpensiveOperation();
done(); // debug: expensive operation '555 milliseconds'
```

```typescript
// to set up config using the built-in logger do this:
import { createConfig, BuiltinLogger } from "express-zod-api";

const config = createConfig({ logger: { level: "debug", color: true } });

declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}
```

### v20.4.1

- Technical update due to improved builder configuration:
  - Removed crutches for the `migration/index.d.cts` file;
  - Fixed missing `node:` protocol in the imports of core modules in the distributed javascript files.

### v20.4.0

- Feat: middleware testing helper: `testMiddleware()`, similar to `testEndpoint()`:
  - There is also an ability to pass `options` collected from outputs of previous middlewares, if the one being tested
    somehow depends on them.
  - The method returns: `Promise<{ output, requestMock, responseMock, loggerMock }>`;
  - Export fixed in v20.14.3.

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

### v20.3.2

- Minor corrections to the documentation.

### v20.3.1

- Removed `eslint` and `prettier` from the list of the optional peer dependencies:
  - `eslint` with a flat config support (v8 or v9) is only required to use [the migration codemod](#v2000);
  - `prettier` is only a fallback for `Integration::printFormatted()`, which can work without it as well;
  - These changes aim to reduce the confusion and ease the installation;
  - The issue was found and reported by **Bogdan** who does not have a GitHub account.

### v20.3.0

- Feature: `z.object().remap()` accepts a mapping function:
  - Similar to `.transform()` you can now supply an object shape mapping function;
  - It is important to use shallow transformations only;
  - Using `.remap()` is recommended for `output` schemas if you're also aiming to generate a valid documentation.

```ts
import camelize from "camelize-ts";
import snakify from "snakify-ts";
import { z } from "zod";

const endpoint = endpointsFactory.build({
  method: "get",
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

### v20.2.0

- Feature: Partial mapping and passthrough support for `z.object().remap()`:
  - Properties can be omitted in `remap()` in order to preserve them unchanged;
  - Undeclared keys will remain unchanged for `z.object().passthrough().remap()` schema;
    - Passthrough object schemas are not allowed in Middlewares, but they are allowed in Endpoints.

```ts
z.object({ user_name: z.string(), id: z.number() }).remap({
  user_name: "userName", // —> { userName, id }
});

z.object({ user_id: z.string() })
  .passthrough()
  .remap({ user_id: "userId" })
  .parse({ user_id: "test", extra: "excessive" }); // —> { userId, extra }
```

### v20.1.0

- Feature: Top level transformations support and object schema remapping:
  - This can enable having `snake_case` API parameters while keeping `camelCase` naming in your implementation;
  - You can `.transform()` the entire `input` schema into another object, using a well-typed mapping library;
  - You can do the same with the `output` schema, but that would not be enough for generating a valid documentation;
  - The framework offers a new `.remap()` method on the `z.object()` schema that applies a `.pipe()` to transformation;
    - Currently `.remap()` requires an assignment of all the object props explicitly, but it may be improved later;
  - Find more details [in the documentation](README.md#top-level-transformations-and-mapping);
  - The feature suggested by [Peter Rottmann](https://github.com/rottmann).

```ts
import camelize from "camelize-ts";
import { z } from "zod";

const endpoint = endpointsFactory.build({
  method: "get",
  input: z
    .object({ user_id: z.string() })
    .transform((inputs) => camelize(inputs, true)), // shallow
  output: z.object({ userName: z.string() }).remap({ userName: "user_name" }),
  handler: async ({ input: { userId }, logger }) => {
    logger.debug("user_id became userId", userId);
    return { userName: "Agneta" }; // becomes "user_name" in response
  },
});
```

### v20.0.1

- Found a better method for asserting the expected response: `responseMock._getJSONData()`.

### v20.0.0

- Method `createLogger()` removed — use `new BuiltinLogger()` instead if needed;
- Method `createResultHandler` removed — use `new ResultHandler()` instead:
  - The argument's properties renamed: `getPositiveResponse` to `positive` and `getNegativeResponse` to `negative`;
  - Both properties can now accept static values (not only functions).
- Method `createMiddleware()` removed — use either `new Middleware()` or `EndpointsFactory::addMiddleware()` instead:
  - The argument's property `middleware` renamed to `handler`.
- Method `testEndpoint()` was changed:
  - It was detached from any testing frameworks, `fnMethod` property removed from the argument;
  - Mocked request and response are now fully operational and do not require to mock anything to do the job;
  - The `responseProps` property changed to `responseOptions`, it's no longer meant to be used for custom props;
  - The returned entities `requestMock`, `responseMock` and `loggerMock` no longer rely on testing framework for props.  
    Instead, they provide methods to assert expectations in tests:
    - `responseMock._getStatusCode()`, `responseMock._getHeaders()`, `responseMock._getData()`, `loggerMock._getLogs()`;
    - See [the documentation of node-mocks-http library](https://www.npmjs.com/package/node-mocks-http) for details.
- How to migrate:
  - Consider using the provided ESLint plugin `migration` in order to apply changes automatically (except assertions);
  - Or follow the code samples below in order to rename/remove entities manually as described above.

```js
// eslint.config.mjs — minimal config to apply migrations automatically using "eslint . --fix" (at least ESLint 8)
import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [{ languageOptions: { parser }, files: ["**/*.ts"] }, migration];
```

```ts
// before
createResultHandler({
  getPositiveResponse: (data) => z.object({ data }),
  getNegativeResponse: () => ({
    schema: z.string(),
    mimeType: "text/plain",
  }),
});

// after
new ResultHandler({
  positive: (data) => z.object({ data }),
  negative: { schema: z.string(), mimeType: "text/plain" }, // can be static now
});
```

```ts
// before
factory.addMiddleware(
  createMiddleware({
    input: z.object({}),
    middleware: async () => ({}),
  }),
);

// after
factory // variant 1:
  .addMiddleware(
    new Middleware({
      input: z.object({}),
      handler: async () => ({}),
    }),
  ) // variant 2: short syntax now available:
  .addMiddleware({ input: z.object({}), handler: async () => ({}) });
```

```ts
// before
declare module "express-zod-api" {
  interface MockOverrides extends Mock {} // remove it
}
const { responseMock: responseMockBefore, loggerMock: loggerMockBefore } =
  testEndpoint({ endpoint });
expect(responseMockBefore.set).toHaveBeenCalledWith("X-Custom", "one");
expect(responseMockBefore.status).toHaveBeenCalledWith(200);
expect(loggerMockBefore.error).not.toHaveBeenCalled();

// after
const { responseMock, loggerMock } = testEndpoint({ endpoint });
expect(responseMock._getStatusCode()).toBe(200);
expect(responseMock._getHeaders()).toHaveProperty("x-custom", "one"); // lower case!
expect(responseMock._getJSONData()).toEqual({ status: "success" });
expect(loggerMock._getLogs().error).toHaveLength(0);
```

## Version 19

### v19.3.0

- Feat: Supporting `vitest` version 2:
  - Released today. Find the migration guide here: https://vitest.dev/guide/migration.html#migrating-to-vitest-2-0

### v19.2.3

- `ansis` version `^3.2.0`;
- `openapi3-ts` version `^4.3.3`;
- `ramda` version `^0.30.1`;
- Several optimizations to the implementation enabled by Typescript 5.5;

### v19.2.2

- Fixed missing defaults for Built-in Logger: color support autodetection and `depth=2`:
  - Those features were lost in version 19.2.0.

### v19.2.1

- `openapi3-ts` version is 4.3.2 (fixed distribution).

### v19.2.0

- Feat: `.child()` method for the built-in logger:
  - You can assign request ID to the log entries without additional libraries now:

```ts
import { randomUUID } from "node:crypto";
import { BuiltinLogger, createConfig } from "express-zod-api";

declare module "express-zod-api" {
  interface LoggerOverrides extends BuiltinLogger {}
}

const config = createConfig({
  logger: { level: "debug", color: true },
  childLoggerProvider: ({ parent }) =>
    parent.child({ requestId: randomUUID() }),
});
```

### v19.1.2

- Fixed a bug on logger instance recognition failure:
  - When an instance of `winston` logger was assigned in config, it was not recognized as an actual logger;
  - That led to using the built-in logger having reduced capabilities;
  - Other loggers could be also affected by this issue;
  - The issue was found and reported by [@boarush](https://github.com/boarush).

### v19.1.1

- Fixed a bug on duplicated or missing request header parameters in the generated Documentation:
  - The issue corresponds to the "Headers as input source" opt-in feature;
  - When `query` was not listed in the input sources:
    - Headers used to be missing in the documented request parameters.
  - When `body` was listed along with `query` in the input sources:
    - Headers used to be duplicated into the documented request body.
  - The issue was found and reported by [@boarush](https://github.com/boarush).

### v19.1.0

- Feature: customizable handling rules for your branded schemas in Documentation and Integration:
  - You can make your schemas special by branding them using `.brand()` method;
  - The framework (being a Zod Plugin as well) distinguishes the branded schemas in runtime;
  - The constructors of `Documentation` and `Integration` now accept new property `brandHandling` (object);
  - Its keys should be the brands you want to handle in a special way;
  - Its values are functions having your schema as the first argument and a context in the second place;
  - In case you need to reuse a handling rule for multiple brands, use the exposed types `Depicter` and `Producer`;
  - The feature suggested by [@shawncarr](https://github.com/shawncarr).

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

### v19.0.0

- **Breaking changes**:
  - Increased the minimum supported versions:
    - For Node.js: 18.18.0, 20.9.0 or 22.0.0;
    - For `zod`: 3.23.0;
    - For `express`: [4.19.2](https://github.com/expressjs/express/security/advisories/GHSA-rv95-896h-c2vc);
    - For `express-fileupload` and `@types/express-fileupload`: 1.5.0.
  - Removed the deprecated method ~~`withMeta()`~~ (see [v18.5.0](#v1850) for details);
  - Removed support for static options by `EndpointsFactory::addOptions()` (see [v18.6.0](#v1860) for details);
  - Freezed the arrays returned by the methods or exposed by properties of `Endpoint` and `DependsOnMethod`;
  - Changed interface for `ez.raw()`: additional properties should be supplied as its argument, not via `.extend()`;
  - Changed the following config options:
    - The function assigned to `server.upload.beforeUpload` now accepts `request` instead of `app`;
    - The function assigned to `server.beforeRouting` is now called before parsing too.
- Features:
  - New configurable level `info` for built-in logger (higher than `debug`, but lower than `warn`);
  - Selective parsers equipped with a child logger:
    - There are 3 types of endpoints depending on their input schema: having `ez.upload()`, having `ez.raw()`, others;
    - Depending on that type, only the parsers needed for certain endpoint are processed;
    - This makes all requests eligible for the assigned parsers and reverts changes made in [v18.5.2](#v1852);
    - Specifying `rawParser` in config is no longer needed to enable the feature.
- Non-breaking significant changes:
  - Request logging reflects the actual path instead of the configured route, and it's placed in front of parsing:
    - The severity of those messaged reduced from `info` to `debug`;
  - The debug messages from uploader are enabled by default when the logger level is set to `debug`;
- How to migrate confidently:
  - Upgrade Node.js, `zod`, `express`, `express-fileupload` and `@types/express-fileupload` accordingly;
  - Avoid mutating the readonly arrays;
  - If you're using ~~`withMeta()`~~:
    - Remove it and unwrap your schemas — you can use `.example()` method directly.
  - If you're using `.addOptions()` on `EndpointsFactory` instance:
    - Replace the argument with an async function returning those options;
    - Or assign those options to `const` and import them where needed.
  - If you're using `ez.raw().extend()` for additional properties:
    - Supply them directly as an argument to `ez.raw()` — see the example below.
  - If you're using `beforeUpload` in your config:
    - Adjust the implementation according to the example below.
  - If you're using `beforeRouting` in your config for anything that requires a parsed request body:
    - Add the required parsers using `app.use()` statements to the assigned function.
  - If you're having `rawParser: express.raw()` in your config:
    - You can now remove this line (it's the default value now), unless you're having any customizations.

```ts
import createHttpError from "http-errors";
import { createConfig } from "express-zod-api";

const before = createConfig({
  server: {
    upload: {
      beforeUpload: ({ app, logger }) => {
        app.use((req, res, next) => {
          if (req.is("multipart/form-data") && !canUpload(req)) {
            return next(createHttpError(403, "Not authorized"));
          }
          next();
        });
      },
    },
  },
});

const after = createConfig({
  server: {
    upload: {
      beforeUpload: ({ request, logger }) => {
        if (!canUpload(request)) {
          throw createHttpError(403, "Not authorized");
        }
      },
    },
  },
});
```

```ts
import { z } from "zod";
import { ez } from "express-zod-api";

const before = ez.raw().extend({
  pathParameter: z.string(),
});

const after = ez.raw({
  pathParameter: z.string(),
});
```

## Version 18

### v18.6.2

- Compatibility improvement for Jest: all dynamic `import()` in CJS build are replaced with `require()`.

### v18.6.1

- Notice on creating connections within a function supplied to `EndpointsFactory::addOptions()`:
  - Use it with caution: a new connection will be created for every request handled by endpoint made on that factory;
  - Consider reusing `const` across your files for persistent connections;
  - In case of intentional non-persistent connection, consider resources cleanup if necessary:

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

### v18.6.0

- Feat: Supporting async function as an argument for `EndpointsFactory::addOptions()`:
  - I realized that it does not make sense for `.addOptions` just to proxy the static data;
  - In case your options are static you can just `import` the corresponding `const` instead;
  - Static options are deprecated and its support will be removed in v19.

```ts
import { readFile } from "node:fs/promises";
import { defaultEndpointsFactory } from "express-zod-api";

const endpointsFactory = defaultEndpointsFactory.addOptions(async () => {
  // caution: new connection on every request:
  const db = mongoose.connect("mongodb://connection.string");
  const privateKey = await readFile("private-key.pem", "utf-8");
  return { db, privateKey };
});
```

### v18.5.2

- Muted uploader logs related to non-eligible requests;
- Another performance improvement.

### v18.5.1

- A small performance improvement for `Integration` and `Documentation`.

### v18.5.0

- Major update on metadata: ~~`withMeta()`~~ is no longer required, deprecated and will be removed in v19:
  - ~~`withMeta()`~~ was introduced in version 2.10.0, because I didn't want to alter Zod's prototypes;
  - However, the [new information](https://github.com/colinhacks/zod/pull/3445#issuecomment-2091463120) arrived
    recently from the author of Zod on that matter;
  - It turned out that altering Zod's prototypes is exactly the recommended approach for extending its functionality;
  - Therefore `express-zod-api` from now on acts as a plugin for Zod, adding the `.example()` and `.label()` methods to
    its prototypes that were previously available only after wrapping the schema in ~~`withMeta()`~~.

```ts
import { z } from "zod";
import { withMeta } from "express-zod-api";

const before = withMeta(
  z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
)
  .example("2024-05-04T10:47:19.575Z")
  .label("Today");

const after = z
  .string()
  .datetime()
  .default(() => new Date().toISOString())
  .example("2024-05-04T10:47:19.575Z")
  .label("Today");
```

### v18.4.0

- Ability to replace the default value with a label in the generated Documentation:
  - Introducing `.label()` method only available after wrapping `ZodDefault` into `withMeta()`;
  - The specified label replaces the actual value of the `default` property in documentation.

```ts
import { z } from "zod";
import { withMeta } from "express-zod-api";

const labeledDefaultSchema = withMeta(
  z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
).label("Today");
```

### v18.3.0

- Changed default behaviour when using built-in logger while omitting its `color` option in config:
  - Automatically detecting the terminal color support by default.

### v18.2.0

- Supporting Node 22;
- Featuring `zod-sockets` for implementing subscriptions on your API:
  - I have developed an additional websocket operating framework, Zod Sockets, which has similar principles and
    capabilities, so that the user could subscribe to subsequent updates initiated by the server;
  - Check out an [example of the synergy between two frameworks](https://github.com/RobinTail/zod-sockets#subscriptions)
    and the [Demo Chat application](https://github.com/RobinTail/chat);
  - The feature suggested by [@ben-xD](https://github.com/ben-xD).

### v18.1.0

- Optimization for `zod` 3.23:
  - `zod` 3.23 offers
    [several features on handling strings](https://github.com/colinhacks/zod/releases/tag/v3.23.0);
  - It's also claimed to be "the final 3.x release before Zod 4.0".;
  - Using the featured `zod` refinements in the following proprietary schemas: `ez.dateIn()` and `ez.file("base64")`;
  - The changes are non-breaking and the compatibility to `zod` 3.22 remains;
  - Validation error messages will depend on actual `zod` version installed.

### v18.0.0

- **Breaking changes**:
  - `winston` is no longer a default logger;
  - `createLogger()` argument is changed, and it now returns a built-in logger instead of `winston`.
- Features:
  - New built-in console logger with colorful pretty inspections and basic methods only.
- Non-breaking significant changes:
  - Due to detaching from `winston`, the `attachRouting()` method is back to being synchronous.
- How to migrate confidently:
  - If you're using `attachRouting()` method:
    - Remove `await` before it (and possible async IIFE wrapper if present) — no longer required.
  - If you're using a custom logger in config:
    - No action required.
  - If you're using `createLogger()` method in your code:
    - Remove the `winston` property from its argument.
  - If you're using the default logger in config (which used to be `winston` as a peer dependency):
    - If you're only using its `info()`, `debug()`, `error()` and `warn()` methods:
      - You can now uninstall `winston` — no further action required.
    - If you're using its other methods, like `.child()` or `profile()`:
      - Configure `winston` as a custom logger [according to the documentation](README.md#customizing-logger),
      - Or consider any other compatible logger, like `pino` for example, which is easier to configure.

## Version 17

### v17.7.1

- Clarification of the documentation: the `skipLibCheck` option should be enabled in `tsconfig.json`.

### v17.7.0

- Publishing with provenance statements to increase the supply-chain security.

### v17.6.1

- Add missing `z.tuple().rest()` type to the generated client (Integration) when present.

### v17.6.0

- Using `const` property for depicting `z.literal()` in the generated documentation;
- Fixed possibly invalid values of `type` property when depicting `z.literal()`, `z.enum()` and `z.nativeEnum()`.

```yaml
- schema: z.literal("success")
  before:
    type: string
    enum: # replaced
      - success
  after:
    type: string
    const: success
- schema: z.literal(null)
  before:
    type: object # fixed
    enum:
      - null
  after:
    type: "null"
    const: null
```

### v17.5.0

- Depicting the `.rest()` part of `z.tuple()` in the generated `Documentation`:
  - when `.rest()` is not used, additional `items` are not allowed;
  - when `.rest()` is used, additional `items` assigned with the corresponding type.

```yaml
noRest: # z.tuple([z.boolean(), z.string()])
  before:
    type: array
    prefixItems:
      - type: boolean
      - type: string
  after:
    type: array
    prefixItems:
      - type: boolean
      - type: string
    items: # added
      not: {} # alias for false, which is not supported
withRest: # z.tuple([z.boolean()]).rest(z.string())
  before:
    type: array
    prefixItems:
      - type: boolean
  after:
    type: array
    prefixItems:
      - type: boolean
    items: # added
      type: string
```

### v17.4.1

- Technical update: no features, no fixes.
- Minor adjustments to the documentation.
- Removed some internal typings that are no longer required.
- Upgrades to development environment.
- Overall, a lot of work has been done to ensure that you won't feel any difference (kinda great in its own way).

### v17.4.0

- Featuring `options` in Result Handler.
  - The same ones that come from the middlewares to Endpoint's handler.
  - You can use them for cleaning up resources (if required) allocated by the entities created by middlewares.
  - Suggested use case: database clients that do not close their connections when their instances are destroyed.
  - The `options` coming to Result Handler can be empty or incomplete in case of errors and failures.

```typescript
import {
  createResultHandler,
  EndpointsFactory,
  createMiddleware,
} from "express-zod-api";

const resultHandlerWithCleanup = createResultHandler({
  handler: ({ options }) => {
    if ("dbClient" in options && options.dbClient) {
      (options.dbClient as DBClient).close(); // sample cleanup
    }
    // your implementation
  },
});

const dbProvider = createMiddleware({
  handler: async () => ({
    dbClient: new DBClient(), // sample entity that requires cleanup
  }),
});

const dbEquippedFactory = new EndpointsFactory(
  resultHandlerWithCleanup,
).addMiddleware(dbProvider);
```

### v17.3.0

- Ability to use the configured logger for debugging uploads.
  - In the `express-fileupload` package starting from version 1.5.0
    [I made the logger customizable](https://github.com/richardgirges/express-fileupload/pull/371).
  - Using at least the specified version of `express-fileupload` and having its `debug` option enabled, the upload
    related logs are processed using the logger from the `express-zod-api` configuration.
  - Please note: the `.debug()` method of the configured logger is used for upload related logging, therefore the
    severity `level` of that logger must be configured accordingly in order to see those messages.

```typescript
import { createConfig } from "express-zod-api";
import { Logger } from "winston";

// using Winston logger
declare module "express-zod-api" {
  interface LoggerOverrides extends Logger {}
}

const config = createConfig({
  server: {
    listen: 8090,
    logger: { level: "debug" }, // simplified Winston config enabling debug level
    upload: { debug: true }, // writes messages using Winston::debug()
  },
});
```

```text
info: Listening 8090
debug: Express-file-upload: New upload started avatar->file.svg, bytes:0
debug: Express-file-upload: Uploading avatar->file.svg, bytes:1138...
debug: Express-file-upload: Upload finished avatar->file.svg, bytes:1138
debug: Express-file-upload: Upload avatar->file.svg completed, bytes:1138.
debug: Express-file-upload: Busboy finished parsing request.
info: POST: /v1/avatar/upload
```

### v17.2.1

- Fixed a bug due to which a custom logger instance could be perceived as a simplified `winston` logger config.
  - In particular, the issue arose for `pino` logger having the `level` option set to `debug`, `warn` or `silent`.
  - This led to an attempt to load the `winston` logger, which may not have been installed.
  - In this case, the following error occurred: `[MissingPeerError]: Missing peer dependency: winston`.
  - The issue was found and reported by [@daniel-white](https://github.com/daniel-white).

### v17.2.0

- Introducing `beforeUpload` option for the `upload` option in config:
  - A code to execute before connecting the upload middleware;
  - It can be used to connect a middleware that restricts the ability to upload;
  - It accepts a function similar to `beforeRouting`, having `app` and `logger` in its argument.

```typescript
import createHttpError from "http-errors";
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    upload: {
      beforeUpload: ({ app, logger }) => {
        app.use((req, res, next) => {
          if (req.is("multipart/form-data") && !canUpload(req)) {
            return next(createHttpError(403, "Not authorized"));
          }
          next();
        });
      },
    },
  },
});
```

### v17.1.2

- Fixed Uncaught Exception when using `limitError` feature.
  - The exception was caused by excessive `next()` call from `express-fileupload` after handling the `limitError`.
  - The issue did not affect the actual response since it had already been sent.
  - In general, the problem arose due to asynchronous processing.
  - The version introduces an upload failure handler instead of relying on the `limitHandler` of `express-fileupload`.
  - Thus, handling the failed uploads is carried out after completing them.
  - The specified `limitError` is only applicable to the `fileSize` limit, other limits do not trigger errors.
  - The `limitError` feature introduced in v17.1.0.

### v17.1.1

- Fixed wrong status code sending in case of upload failures when `limitError` is `HttpError`.
  - The feature introduced in v17.1.0.
  - The status code used to be always `400`.

### v17.1.0

- Ability to configure upload limits and an error in case the uploaded file exceeds them:
  - Enabled `limits` option for `upload` feature in config;
  - See the [Busboy documentation](https://www.npmjs.com/package/busboy#exports) for details on `limits`;
  - Added `limitError` option to `upload` feature in config (optional);
  - The error assigned to `limitError` is handled by `errorHandler` in config (the negative response case);
  - When the `limitError` is not set, the `truncated` property of the uploaded file reflects the issue;
  - Thanks to [@rottmann](https://github.com/rottmann) for his contribution.

```ts
import { createConfig } from "express-zod-api";
import createHttpError from "http-errors";

export const config = createConfig({
  server: {
    upload: {
      limits: { fileSize: 51200 },
      limitError: createHttpError(413, "The file is too large"),
    },
  },
});
```

### v17.0.1

- Fixed logo for terminals supporting only 256 colors.

### v17.0.0

- **Breaking changes**:
  - `DependsOnMethod::endpoints` removed;
  - Refinement methods of `ez.file()` removed;
  - Minimum version of `vitest` supported is 1.0.4.
- How to migrate confidently:
  - If you're using refinement methods of `ez.file()`:
    - Replace ~~`ez.file().string()`~~ to `ez.file("string")`;
    - Replace ~~`ez.file().buffer()`~~ to `ez.file("buffer")`;
    - Replace ~~`ez.file().base64()`~~ to `ez.file("base64")`;
    - Replace ~~`ez.file().binary()`~~ to `ez.file("binary")`.
  - If you're using `DependsOnMethod::endpoints`:
    - Use the `pairs` property instead.
  - If you're using version 0 of `vitest`:
    - Upgrade it to the latest v1.

## Version 16

### v16.8.1

- Changed the order of an operation properties within generated Documentation.
  - That should make it more human-readable even without using any UI.
  - The new order briefly: explanation — first, request making — second, possible responses — last.

```yaml
before:
  - operationId
  - responses
  - description
  - summary
  - tags
  - parameters
  - requestBody
  - security
after:
  - operationId
  - summary
  - description
  - tags
  - parameters
  - requestBody
  - security
  - responses
```

### v16.8.0

- Fixed a bug on logging objects having circular references by the default `winston` logger.
  - The issue only occurred if the `level` was set to `warn`.
  - In that particular case objects were serialized using the `JSON.stringify()` method to reduce production logs.
  - However, that method could not handle possible circular references within the object.
  - This version relies on `inspect()` method of `node:util` instead, for serializing objects in all cases.
  - When the `level` is set to `debug` the inspected objects will be pretty printed.
  - When the `level` is set to `warn` the inspected objects will be serialized in one line.
- Additionally, new option `depth` added to `SimplifiedWinstonConfig` that can be `number | null` being `2` by default.
  - The option controls how deeply the objects should be inspected, serialized and printed.
  - It can be set to `null` or `Infinity` for unlimited depth.

```typescript
// Reproduction example
import { createConfig, createServer } from "express-zod-api";

const config = createConfig({ logger: { level: "warn" } });
const { logger } = await createServer(config, {});

const subject = {};
subject.prop = subject;

// before: TypeError: Converting circular structure to JSON
// after:  Circular reference <ref *1> { prop: [Circular *1] }
logger.error("Circular reference", subject);
```

```typescript
// Feature example
import { createConfig } from "express-zod-api";

createConfig({ logger: { level: "debug", color: true, depth: 4 } });
createConfig({ logger: { level: "debug", depth: Infinity } });
createConfig({ logger: { level: "warn", depth: null } });
```

### v16.7.1

- Fixed logging arrays by the default `winston` logger.

```typescript
// before: Items { '0': 123 }
// after:  Items [ 123 ]
logger.debug("Items", [123]);
```

### v16.7.0

- Introducing the `beforeRouting` feature for the `ServerConfig`:
  - The new option accepts a function that receives the express `app` and a `logger` instance.
  - That function runs after parsing the request but before processing the `Routing` of your API.
  - But most importantly, it runs before the "Not Found Handler".
  - The option enables the configuration of the third-party middlewares serving their own routes or establishing their
    own routing besides your primary API when using the standard `createServer()` method.
  - The option helps to avoid making a custom express app, the DIY approach using `attachRouting()` method.
  - The option can also be used to connect additional request parsers, like `cookie-parser`.

```ts
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

### v16.6.2

- Internal method `Endpoint::_setSiblingMethods()` removed (since v8.4.1);
- The public property `DependsOnMethod::endpoints` is deprecated and will be removed in v17.

### v16.6.1

- Performance fix for uploads processing (since v16.1.0).

### v16.6.0

- Refactoring: using a walker (traverse) for checking nested schemas.
  - This improved the performance and made it easier to scale and reuse.
- Performance fix for metadata processing (since v16.2.1).

### v16.5.4

- Refactoring: simplified the `next()` method of the schema walker (traverse).

### v16.5.3

- Fixed the bug #1517 found and reported by [@kotsmile](https://github.com/kotsmile):
  - The minimum allowed float was incorrectly specified in the generated documentation;
  - Applies only to `z.number()` having no `.min()` and no `.int()` refinements.

```yaml
before:
  type: number
  format: double
  minimum: 5e-324 # <——— bug
  maximum: 1.7976931348623157e+308
after:
  type: number
  format: double
  minimum: -1.7976931348623157e+308 # <——— correct
  maximum: 1.7976931348623157e+308
```

### v16.5.2

- Refactoring: rewrote some reducers using declarative and functional approach.
  - In certain cases it improved the performance slightly.

### v16.5.1

- Excluding empty `properties` in the generated documentation.
  - Applies to both `z.object()` and `z.record()`.

```yaml
before:
  type: object
  properties: {}
after:
  type: object
```

### v16.5.0

- Flattening nested intersections of object schemas in the generated documentation:
  - Intersections (`.and()`) help to combine input schemas of endpoints and middlewares into a single schema;
  - When endpoint uses several middlewares it could lead to multiple nested `allOf` entries;
  - This version tries to flatten them when possible, thanks to [@arlyon](https://github.com/arlyon)'s contribution.

```yaml
before:
  allOf:
    - type: object
      properties:
        a:
          type: string
      required:
        - a
    - type: object
      properties:
        b:
          type: string
      required:
        - b
after:
  type: object
  properties:
    a:
      type: string
    b:
      type: string
  required:
    - a
    - b
```

### v16.4.1

- Removed redundant duplication when documenting the request parameters.

### v16.4.0

- Featuring the child logger support for your convenience:
  - In case you need a slightly different or preconfigured logger for each request, the new feature comes handy;
  - The common use case is logging a unique request ID;
  - Previously, for that purpose you most likely used middlewares, but there is a better way now;
  - In the configuration you can now specify `childLoggerProvider` returning a logger instance;
  - When specified, the returned child logger will replace the `logger` in all handlers for each request;
  - The provider function receives the initially configured logger and the request, it can also be asynchronous;
  - Consider the following example in case of Winston logger:

```typescript
import { createConfig } from "express-zod-api";
import { Logger } from "winston"; // or another compatible logger
import { randomUUID } from "node:crypto";

declare module "express-zod-api" {
  // this approach enables the .child() method availability
  interface LoggerOverrides extends Logger {}
}

const config = createConfig({
  // logger: ...,
  childLoggerProvider: ({ parent, request }) =>
    parent.child({ requestId: randomUUID() }),
});
```

### v16.3.0

- Switching to using native `zod` methods for proprietary schemas instead of custom classes (`ez` namespace):
  - Each proprietary schema now relies on internal Metadata;
  - Validation errors for `ez.file()` are changed slightly;
  - The following refinements of `ez.file()` are deprecated and will be removed later:
    - ~~`ez.file().string()`~~ — use `ez.file("string")` instead,
    - ~~`ez.file().buffer()`~~ — use `ez.file("buffer")` instead,
    - ~~`ez.file().base64()`~~ — use `ez.file("base64")` instead,
    - ~~`ez.file().binary()`~~ — use `ez.file("binary")` instead.

### v16.2.2

- Fixed issue #1458 reported by [@elee1766](https://github.com/elee1766):
  - `z.string()` having RegExp based refinements were incorrectly described by `Documentation` (`pattern` property).

### v16.2.1

- Refactoring some methods involved in metadata and schema processing.
- Fixed several messages of errors related to documenting proprietary schemas.

### v16.2.0

- Notice: upgrading to this version, make sure you are NOT supplying type parameters to the `EndpointsFactory`:
  - `new EndpointsFactory(...)` — correct,
  - ~~`new EndpointsFactory<...>(...)`~~ — incorrect,
  - See [issue #1444](https://github.com/RobinTail/express-zod-api/issues/1444) for details.
- Feature #1431: Ability to declare different response schemas for different HTTP status codes.
  - Previously, `ResultHandler` could only have one schema and one status code for its positive and negative responses.
  - Assuming the purposes of consistent responses, one pair was enough, giving decisive importance to their payload.
  - However, based on discussions #1193 and #1332, and thanks to [@danclaytondev](https://github.com/danclaytondev)
    and [@huyhoang160593](https://github.com/huyhoang160593) this version brings an ability for `ResultHandler` to
    respond slightly differently for different status codes, as well as defining several codes per response variant.
  - All that is taken into account when generating the Documentation or a frontend client (Integration).
  - Consider the following example of a REST API's entity creation endpoint as a guideline:

```ts
import { z } from "zod";
import {
  EndpointsFactory,
  createResultHandler,
  getStatusCodeFromError,
} from "express-zod-api";
import assert from "node:assert/strict";
import createHttpError from "http-errors";

const statusDependingFactory = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: (output) => ({
      statusCodes: [201, 202], // multiple status codes for one positive response schema
      schema: z.object({ status: z.literal("created"), data: output }),
    }),
    getNegativeResponse: () => [
      {
        statusCode: 409, // special response schema for the status code
        schema: z.object({ status: z.literal("exists"), id: z.number().int() }),
      },
      {
        statusCodes: [400, 500], // additional response schema for multiple status codes
        schema: z.object({ status: z.literal("error"), reason: z.string() }),
      },
    ],
    handler: ({ error, response, output }) => {
      if (error) {
        const code = getStatusCodeFromError(error);
        const payload =
          code === 409 && "id" in error && typeof error.id === "number"
            ? { status: "exists", id: error.id }
            : { status: "error", reason: error.message };
        response.status(code).json(payload);
        return;
      }
      response.status(201).json({ status: "created", data: output });
    },
  }),
);

const entityCreationEndpoint = statusDependingFactory.build({
  method: "post",
  input: z.object({ name: z.string().min(1) }),
  output: z.object({ id: z.number().int().positive() }),
  handler: async ({ input: { name } }) => {
    assert(
      isNewName, // sample condition
      createHttpError(409, "That one already exists", { id: 16 }),
    );
    return { id: 16 }; // sample id
  },
});
```

### v16.1.0

- Improving the documentation of endpoints based on middlewares having `security` schema with `type: "input"`.
  - According to the OpenAPI specification, endpoints designed to accept some authentication key are expected to
    receive it as the request query parameter,
  - However `express-zod-api` is designed to combine multiple properties of the `Request` into a single `input` object.
  - Those properties are configurable for each method via the `inputSources` config option.
  - Therefore, the authentication key for the such middleware can alternatively OR must actually be supplied within
    the request body, depending on the API configuration.
  - The depiction of security schema as a one expecting the query parameter (due to the limitation of the OpenAPI)
    could lead to discrepancies or confusion, so this version offers a solution for that problem.
  - Depending on the case, along with the `in` property, either the `x-in-alternative` or `x-in-actual` extension is
    added to the security schema depiction, as well as the `description` property explaining the case.

```ts
const authMiddleware = createMiddleware({
  security: { type: "input", name: "key" },
});

const config = createConfig({
  inputSources: {
    patch: ["body", "query"], // has request body as alternative input source
    put: ["body"], // does not have the request query as input source
  },
});
```

```yaml
securitySchemes:
  FOR_PATCH_REQUEST:
    type: apiKey
    in: query
    name: key
    x-in-alternative: body # added
    description: key CAN also be supplied within the request body
  FOR_PUT_REQUEST:
    type: apiKey
    in: query # can not be set to "body"
    name: key
    x-in-actual: body # added
    description: key MUST be supplied within the request body instead of query
```

### v16.0.0

- Potentially breaking changes:
  - Some methods and properties of the `Documentation` class (which extends the OpenAPI builder) might be changed.
  - Options `successfulResponseDescription` and `errorResponseDescription` of `Documentation` constructor are renamed.
- Features:
  - Switching to [OpenAPI 3.1](https://swagger.io/specification/) for generating better Documentation for your API.
    - Consider [the new UI](https://editor-next.swagger.io/) for exploring the produced documentation.
  - Improved way of configuring descriptions and naming of the generated documentation components:
    - Introducing the new option `descriptions` holding several formatting functions.
  - Ability to generate formatted typescript client using the new async method `printFormatted` of the `Integration`
    class when the `prettier` package is installed (detects automatically).
    - Ability to supply your own typescript formatting function into that new method.
  - Ability to split the response types (to positive and negative ones) when generating the client or API types.
    - Featuring the `splitResponse` option of the `Integration` class constructor;
    - The feature suggested by [@shawncarr](https://github.com/shawncarr).
- How to migrate:
  - If you are using `successfulResponseDescription` option of `Documentation` constructor:
    - Replace it with `descriptions/positiveResponse` assigned with the string returning function;
  - If you are using `errorResponseDescription` option of `Documentation` constructor:
    - Replace it with `descriptions/negativeResponse` assigned with the string returning function;
  - If you do not modify the generated documentation and only using its `getSpecAsYaml` or `getSpecAsJson` methods:
    - No further action required.
  - If you're using any properties or other methods of the `Documentation` class:
    - Please refer to the [specification](https://swagger.io/specification/) and the
      [OpenAPI migration guide](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) in order
      to adjust your implementation accordingly.

```ts
import { Documentation, Integration } from "express-zod-api";

// featuring new way of configuring component descriptions and naming:
new Documentation({
  descriptions: {
    positiveResponse: ({ method, path }) =>
      `${method} ${path} successful response`, // replaces successfulResponseDescription
    negativeResponse: ({ method, path }) => `${method} ${path} error response`, // replaces errorResponseDescription
    requestBody: ({ operationId }) => `${operationId} request body`, // featuring
    requestParameter: () => "Parameter", // featuring
  },
});

// regular unformatted integration remains:
new Integration(/*...*/).print();
// featuring the formatted one, detects prettier automatically:
await new Integration(/*...*/).printFormatted();
// featuring, splitted response types:
new Integration({ splitResponse: true });
```

## Version 15

### v15.3.0

- Method `createConfig()` now supports express router as an `app` for using with `attachRouting()` method.
  - Thanks to [@sarahssharkey](https://github.com/sarahssharkey)'s contribution.

```ts
import express from "express";
import { createConfig } from "express-zod-api";

const router = express.Router();
const config = createConfig({ app: router });
```

### v15.2.0

- Supporting Node 20 starting from version 20.0.0 (previously it was 20.1.0).
- Debug message informing on the package build version on startup.
  - It will also tell you whether a CJS or ESM build is running.
- Improved words recognition for automatically generated identifiers in `Integration` and `Documentation`.
  - Thanks to [@shawncarr](https://github.com/shawncarr) for the contribution.

```yaml
method: GET
path: /companies/:companyId/users/:userId
operationId:
  before: GetCompaniesCompanyidUsersUserid
  after: GetCompaniesCompanyIdUsersUserId
```

### v15.1.0

- The distribution becomes ESM first, while remaining dual (CJS support remains).
  - This should not be a breaking change: the right files should be chosen automatically.
  - However, the filenames in `dist` folder are renamed:
    - for ESM: `index.js` and `index.d.ts`,
    - for CJS: `index.cjs` and `index.d.cts`.

### v15.0.1

- Development environment improvements:
  - Transitioned from an exclusive approach to the inclusive one:
    - Introducing the list of `files` included into the distribution (instead of ignoring redundant ones).
  - Stable testing environment:
    - Inclusive, stable and extensible `tsconfig.json` files;
    - Stable `package.json` for integration, ESM and compatibility tests;
    - Dedicated environment for Issue #952 test.
  - Simplified development commands.

### v15.0.0

- **Breaking changes**:
  - Packages `express-fileupload` and `compression` become optional peer dependencies;
  - Methods `createServer()` and `attachRouting()` become async;
  - Method `createLogger()` requires an additional argument;
  - Read the migration guide below.
- Features:
  - Supporting any logger having `debug()`, `warn()`, `info()` and `error()` methods;
    - Package `winston` is now optional;
    - The feature suggested by [@bobgubko](https://github.com/bobgubko).
  - Supporting any testing framework having a function mocking method for `testEndpoint()`:
    - Both `jest` and `vitest` are supported automatically;
    - With most modern Node.js you can also use the integrated `node:test` module.
  - Introducing module augmentation approach for integrating chosen logger and testing framework.
- How to migrate while maintaining previous functionality and behavior:
  - Near your `const config` add a module augmentation statement based on `winston.Logger` type (see example below).
  - If you have `upload` option enabled in your config:
    - Install `express-fileupload` and `@types/express-fileupload` packages;
  - If you have `compression` option enabled in your config:
    - Install `compression` and `@types/compression` packages;
  - If you're using the entities returned from `createServer()` or `attachRouting()` methods:
    - Add `await` before calling those methods.
    - If you can not use `await` (on the top level of CommonJS):
      - Wrap your code with async IIFE or use `.then()` (see example below).
  - If you're using `testEndpoint()` method:
    - Add module augmentation statement once anywhere within your tests based on `jest.Mock` type (see example below).
  - If you're using `createLogger()` helper:
    - Consider using `logger` property supplied to `createConfig()` instead;
    - Otherwise, supply also the `winston` argument to the helper (`import winston from "winston"`).

```typescript
import winston from "winston";
import { createConfig, createLogger, createServer } from "express-zod-api";

// Use the logger property of config to use Winston logger
const config = createConfig({
  logger: { level: "debug", color: true }, // or instance of any compatible logger
});

// If you need that pretty logger outside the API, use the existing helper instead:
const logger = createLogger({ winston, level: "debug", color: true });

// Set the type of the logger used near your configuration
declare module "express-zod-api" {
  interface LoggerOverrides extends winston.Logger {}
}

// if using entities returned from createServer() or attachRouting(): add "await" before it.
// For using await on the top level CJS, wrap it in async IIFE:
// (async () => { await ... })();
const { app, httpServer } = await createServer(config, routing);
```

```typescript
// Adjust your tests: set the MockOverrides type once anywhere
declare module "express-zod-api" {
  interface MockOverrides extends jest.Mock {} // or Mock from vitest
}

// Both jest and vitest are supported automatically
import { testEndpoint } from "express-zod-api";
const { responseMock } = await testEndpoint({ endpoint });

// For other testing frameworks:

// 1. specify fnMethod property
import { mock, Mock } from "node:test";
await testEndpoint({
  endpoint,
  fnMethod: mock.fn.bind(mock), // https://nodejs.org/docs/latest-v20.x/api/test.html#mocking
});
// 2. and set the MockOverrides type once
declare module "express-zod-api" {
  interface MockOverrides extends Mock {} // Mock of your testing framework
}
```

## Version 14

### v14.2.5

- Hotfix for 14.2.4: handling the case of empty object supplied as a second argument to the logger methods.

```typescript
logger.info("Payload", {});
```

### v14.2.4

- Fixed internal logging format when primitive are supplied as a second argument to the logger methods.

```typescript
logger.info("Listening", 8090);
```

### v14.2.3

- `express-fileupload` version is 1.4.3.

### v14.2.2

- Hotfix: exporting `AppConfig` and `ServerConfig` types to in order to prevent the issue #952.

### v14.2.1

- Improving the type of `createConfig()` method by using overloads.
  - This should resolve the confusion on two different types of configuration that this method accepts.
  - The object argument has either to have `server` OR `app` property, it can not have them both.
  - The config having `server` is for using with `createServer()`, while the one having `app` is for `attachRouting()`.
- Upgraded `tsup` and `esbuild` involved in building the distribution.

### v14.2.0

- `express-fileupload` version is 1.4.2.
- Featuring raw data handling in requests: you can now accept `application/octet-stream` typed requests and similar.
  - Including the mentioned MIME type of the request in the generated documentation.
- In order to enable this feature you need to set the `rawParser` config option to `express.raw()`.
  - Explore its additional options [in Express.js documentation](https://expressjs.com/en/4x/api.html#express.raw).
- When the feature is enabled, the raw data is placed into `request.body.raw` property, being `Buffer`.
- The proprietary schema `ez.file()` is now equipped with two additional refinements:
  - `.string()` — for parsing string data, default for backward compatibility;
  - `.buffer()` — for parsing `Buffer` and to accept the incoming raw data;
  - The feature suggested by [@master-chu](https://github.com/master-chu).
- In order to define an input schemas of endpoints and middlewares, a new shorthand schema exposed for your convenience:
  - `ez.raw()` — which is the same as `z.object({ raw: ez.file().buffer() })`.
  - Thus, the raw data becomes available to a handler as `input.raw` property.

```typescript
import express from "express";
import { createConfig, defaultEndpointsFactory, ez } from "express-zod-api";

const config = createConfig({
  server: {
    rawParser: express.raw(), // enables the feature
  },
});

const rawAcceptingEndpoint = defaultEndpointsFactory.build({
  method: "post",
  input: ez
    .raw() // accepts the featured { raw: Buffer }
    .extend({}), // for additional inputs, like route params, if needed
  output: z.object({ length: z.number().int().nonnegative() }),
  handler: async ({ input: { raw } }) => ({
    length: raw.length, // raw is Buffer
  }),
});
```

### v14.1.0

- Featuring an ability to configure `host` and other listening options when using `createServer()` method.
  - The `listen` property now supports object of type `ListenOptions`.
  - Ensure having `@types/node` installed for assistance.
  - Find out more about those options
    [in Node.js documentation](https://nodejs.org/dist/latest-v20.x/docs/api/net.html#serverlistenoptions-callback).
  - Thanks to [@huyhoang160593](https://github.com/huyhoang160593) for noticing the lack of configurability.

```typescript
import { createConfig } from "express-zod-api";

createConfig({
  server: {
    // example usage:
    listen: {
      port: 8080,
      host: "custom",
      backlog: 200,
      ipv6Only: true,
    },
  },
});
```

### v14.0.3

- Fixed issue #1269 reported by [@alindsay55661](https://github.com/alindsay55661):
  - `TS4023: Exported variable ... has or is using name Metadata from external module ... but cannot be named.`

### v14.0.2

- Refactoring: consistent implementation for creating and starting HTTP and HTTPS servers in `createServer()` method.

### v14.0.1

- Technical update: no new features, a bit of cleanup and refactoring.

### v14.0.0

- **Breaking changes**:
  - `http-errors` becomes a peer dependency — you have to install it manually.
    - You might also need to install `@types/http-errors` if you're using `createHttpError` in your implementation.
  - `typescript` is a required peer dependency.
  - Minimum version of `zod` is 3.22.3.
  - The class `DependsOnMethodError` is removed — catch `RoutingError` instead if needed.
- **Potentially breaking changes**:
  - The type `FlatObject` changed from `Record<string, any>` to `Record<string, unknown>`.
    - If a custom `ResultHandler` handles properties of the `output`, it might need to ensure its actual type.
  - In case of body parsing failure the `ResultHandler` receives `null` into its `input` argument instead of raw body.
    - Utilize the `request.body` within a custom `ResultHandler` in that case if needed.
  - The type of `ResultHandler`'s arguments `input` and `output` is changed from `any` to `FlatObject | null`.
- Other changes:
  - Ensure having the following packages installed for the types assistance:
    - `yarn add --dev @types/express @types/node @types/http-errors`
    - or `npm install -D @types/express @types/node @types/http-errors`
  - The property `DependsOnMethod::methods` is renamed to `endpoints`.

```typescript
// before
import { createHttpError } from "express-zod-api";
// after
import createHttpError from "http-errors";
```

## Version 12

### v12.5.1

- Technical update before releasing next major version.
- I also would like to remind you to upgrade your `zod` (peer dependency) to at least 3.22.3.
  - Check out [the security advice](https://github.com/advisories/GHSA-m95q-7qp3-xv42) to find out why.

### v12.5.0

- Featuring an ability to specify multiple server URLs when generating documentation.
  - This feature is a shorthand for `new Documentation().addServer()`

```typescript
new Documentation({
  serverUrl: ["https://example1.com", "https://example2.com"],
  // ...
});
```

### v12.4.0

- Feature: ability to assign a function to the `operationId` property of the `EndpointsFactory::build()` argument.
  - This can help to customize the Operation ID for the endpoints serving multiple methods.

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

defaultEndpointsFactory.build({
  methods: ["get", "post"],
  operationId: (method) => `${method}Something`,
  // ...
});
```

### v12.3.0

- Featuring the ability to customize the `operationId` in the generated documentation.
  - Using the new property of `EndpointsFactory::build()` method you can now override the value of the
    corresponding `operationId` of the endpoint in generated documentation.
  - When using this feature, you must ensure the uniqueness of the IDs you specified across your API endpoints.
  - The feature is implemented by [@john-schmitz](https://github.com/john-schmitz).

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

defaultEndpointsFactory.build({
  operationId: "SampleOperation",
  // ...
});
```

### v12.2.0

- Featuring a new input source: `headers`.
  - This is an opt-in feature requiring you to specify `headers` entry in the `inputSources` of your configuration.
  - The feature is limited to custom headers only (the ones starting with `x-` prefix).
  - The headers are lowercase when describing their validation schema.
  - Parameters in request headers described the following way are supported by the documentation generator.

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

### v12.1.0

- This version fixes the issue 1182 introduced in version 10.0.0-beta1, manifesting as Typescript errors `TS4023` and
  `TS4094` only when `declaration` feature is enabled in your `tsconfig.json`.
  - Several protected properties of `Endpoint` are made entirely private.
  - Several types are exposed: `CommonConfig`, `MiddlewareDefinition`, `ResultHandlerDefinition`, `BasicSecurity`,
    `BearerSecurity`, `CookieSecurity`, `CustomHeaderSecurity`, `InputSecurity`, `OAuth2Security`, `OpenIdSecurity`.
    - They are not meant to be used in your implementation and only needed to prevent the error in particular case.
    - Instead of `CommonConfig` type use `createConfig()` method.
    - Instead of `MiddlewareDefinition` type use `createMiddleware()` method.
    - Instead of `ResultHandlerDefinition` type use `createResultHandler()` method.
    - Instead of the mentioned security types use the `security` property of the `createMiddleware()` argument.
  - The issue 1182 is the continuation of the issue 952 "Insufficient exports" (for consumer's declaration).
    - Found and reported by [@bobgubko](https://github.com/bobgubko)

### v12.0.2

- `express-fileupload` version is 1.4.1.

### v12.0.1

- Minor fixes: JSDoc for `Security` type, `arrayResultHandler` type.
- Minor technical update: all `@types/*` packages have been recently reformatted.

### v12.0.0

- **Breaking changes**:
  - `winston` becomes a peer dependency — you need to install it manually.
  - Minimum Node versions supported: 18.0.0 and 20.1.0.
    - Node versions 16 and 19 are EOL and no longer supported.
  - Minimum Typescript version supported: 5.1.3.
  - Minimum Jest version supported: 28 (optional peer dependency for testing endpoints).
- Other changes:
  - The distribution now consists of 4 files in `dist` directory:
    - for ESM: `index.mjs` and `index.d.mts`,
    - for CJS: `index.js` and `index.d.ts`.
  - Routes having URL params are no longer quoted in the generated documentation.
    - This change is caused by a fix to the `yaml` dependency.

```yaml
before:
  "/v1/user/{id}":
after:
  /v1/user/{id}:
```

## Version 11

### v11.7.0

- Good news for array lovers and those struggling with migrating legacy APIs to use this framework.
- New feature: `arrayResultHandler` (and corresponding `arrayEndpointsFactory`).
  - Please avoid using them for new projects: responding with array is a bad practice keeping your endpoints from
    evolving without breaking changes.
  - This result handler expects your endpoint to have the property named `items` in its output schema.
  - The `items` property should be the `ZodArray` schema.
  - The value of that property is used as the response.
  - Missing the `items` property will result in internal error (status code `500`).
  - The negative response schema is `z.string()`, meaning that in case of error the response will be its plain message.
  - The result handler also supports examples, as well as documentation and client generation.
  - Check out the [example endpoint](/example/endpoints/list-users.ts) for details.
- This version also contains a corresponding fix:
  - Fixed depicting the examples in case of `z.array()` and `z.string()` as response schemas in `ResultHandler`.

```yaml
before:
  examples:
    arrayResponseExample:
      value:
        "0":
          name: Hunter Schafer
        "1":
          name: Laverne Cox
        "2":
          name: Patti Harrison
    stringResponseExample:
      value:
        "0": S
        "1": a
        "2": m
        "3": p
        "4": l
        "5": e
after:
  examples:
    arrayResponseExample:
      value:
        - name: Hunter Schafer
        - name: Laverne Cox
        - name: Patti Harrison
    stringResponseExample:
      value: Sample
```

### v11.6.0

- The generated client is now equipped with the `endpointTags` constant that can be involved into your implementation.
  - Thanks to [@miki725](https://github.com/miki725) for the idea of this feature.

### v11.5.0

- The following methods added to the mocked `response` object for `testEndpoint()` method:
  - `send`, `setHeader`, `header`.

### v11.4.0

- Supporting `z.readonly()` of `zod` v3.22.
  - For the purposes of depicting REST APIs `ZodReadonly` is described the same way as its inner schema.

### v11.3.0

- Thanks to [@dev-m1-macbook](https://github.com/dev-m1-macbook) who noticed that the method needed for getting
  examples within a custom `ResultHandler` is not exported. This problem is now fixed.
  - Exposing `getExamples()` method having object based parameter with following props:
    - `schema` — the subject to retrieve examples from (previously set by `withMeta().example()` method).
    - `variant` _(optional)_ — either `original` _(default)_ or `parsed` literal. The last one applies possible
      transformations.
    - `validate` _(optional)_ — boolean, filters out invalid examples, enabled for `parsed` variant.
  - **Warning**: Getting parsed or validated examples of `z.lazy()` having circular references must be avoided.
  - Despite having two options for various needs, in case of proxying your examples withing a custom `ResultHandler`
    those are not required. Consider the following approach implemented in the default `ResultHandler`:

```ts
const defaultResultHandler = createResultHandler({
  getPositiveResponse: (output: IOSchema) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema = withMeta(
      z.object({
        status: z.literal("success"),
        data: output,
      }),
    );
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        acc.example({
          status: "success",
          data: example,
        }),
      responseSchema,
    );
  },
  // ...
});
```

### v11.2.0

- `winston` version is 3.10.0.
- `triple-beam` version is 1.4.1.
- Rearranged exports in `package.json`.

### v11.1.1

- Technical update, no new features.
  - `@tsconfig/node16` base version is 16.1.0.
  - Using `node:` prefix for importing builtin modules.
  - `typescript` v5.1.6, `esbuild` v0.18.10 and `rollup` v3.25.3.

### v11.1.0

- Sourcemaps are removed from the distribution.
  - No one has ever used them for reporting issues.
  - Their size is significantly large.
- Both CJS and ESM bundles have their own declaration files:
  - `/dist/index.d.ts` for CJS,
  - `/dist/esm/index.d.ts` for ESM.
  - The `exports` entry of `package.json` is adjusted accordingly.

### v11.0.0

- **Breaking changes**:
  - Minimum Node version supported: 16.14.0.
  - `OpenAPIError` renamed to `DocumentationError`.
    - It also now only accepts an object argument. Use its `message` prop instead.
  - `OpenAPI` class removed. Use `Documentation` one instead (same constructor props).
  - `Client` class removed. Use `Integration` one instead (the default `variant` is `client`).

## Version 10

### v10.9.0

- `winston` version is 3.9.0.

### v10.8.1

- Add missing `async` keyword to `ExpressZodAPIClient::provide()` method.

### v10.8.0

- Supporting Node 20.
  - Minimum supported version of Node 20.x is 20.1.0.

### v10.7.1

- For the `new Integration({ variant: "types" })` the following types added:
  - `Path`, `Method`, `MethodPath`, `Input`, `Response`.

### v10.7.0

- Reverting the changes made in v10.2.0: restoring `openapi3-ts` dependency.
  - `openapi3-ts` version is 4.1.2.

### v10.6.0

- Feature #974: Integration variant.
  - `Integration::constructor()` has gotten a new property `variant` with two possible values:
    - `client` _(default)_ — the familiar entity for making typed requests and received typed responses;
    - `types` — only types of your endpoint requests and responses (for making a DIY solution).
  - The deprecated ~~`Client::constructor()`~~ implies `client` variant of `Integration`.

### v10.5.0

- Errors that may occur when generating documentation are now more informative.
  - Changes made to the message of `OpenAPIError` class;
- Example of additional details in the second line of the error message:

```yaml
before: >-
  Using transformations on the top level of input schema is not allowed.
after: |-
  Using transformations on the top level of input schema is not allowed.
  Caused by input schema of an Endpoint assigned to POST method of /v1/user/:id path.
```

### v10.4.0

- For the future features and improvements the following entities are renamed:
  - ~~`Client`~~ class becomes the `Integration`.
  - ~~`OpenAPI`~~ class becomes the `Documentation`.
  - For backward compatibility the previously assigned names are still supported until the next major release.
  - Developers are advised to adjust their implementation accordingly.

```ts
// before
new Client(/*...*/);
new OpenAPI(/*...*/);
// after
new Integration(/*...*/);
new Documentation(/*...*/);
```

### v10.3.2

- Hotfix on fixing the previously mentioned issue #952.
  - The following interfaces are now exported from the index file directly:
    - `ZodFileDef`, `ZodUploadDef`, `ZodDateInDef`, `ZodDateOutDef`.

### v10.3.1

- Attempted to fix the issue #952 of the insufficient exports of the proprietary schema definitions.
  - The issue introduced in version 10.0.0-beta1 due to changing the compiler to `tsup`.
  - The issue manifests only when `declaration` is enabled in your `tsconfig.json`.
  - The issue causes following error:
    - `TS4023: Exported variable '' has or is using name 'ZodFileDef' from external module "" but cannot be named.`
  - The following interfaces are now available within the exported `ez` namespace:
    - `ez.ZodFileDef`, `ez.ZodUploadDef`, `ez.ZodDateInDef`, `ez.ZodDateOutDef`.

### v10.3.0

- Feature #945 for a client generator, proposed by [@McMerph](https://github.com/McMerph).
  - Configurable style of object's optional properties.
  - Client generator has gotten a new parameter `optionalPropStyle` which is an optional object having two optional
    properties: `withQuestionMark` and `withUndefined` that enable customization on the generated types.
    - Example with question mark: `{ someProp?: boolean }`.
    - Example with undefined: `{ someProp: boolean | undefined }`.
  - For backward compatibility the default value is `{ withQuestionMark: true, withUndefined: true }`.
    - Example of default behavior: `{ someProp?: boolean | undefined }`

```ts
// example
new Client({
  routing,
  optionalPropStyle: { withQuestionMark: true }, // no `| undefined`
}).print();
```

### v10.2.0

- The functionality of `openapi3-ts` is implemented inside the library.
  - The code state corresponds to the version 4.1.1 of `openapi3-ts`.

### v10.1.3

- Fixed issue #929, found and reported by [@niklashigi](https://github.com/niklashigi).
  - Customized description of request parameters have not been depicted correctly when generating the documentation.

### v10.1.2

- Fixed issue #907, found and reported by [@McMerph](https://github.com/McMerph).
  - HTTP response status code in case of malformed body or other body-parser errors changed from `500` to `400`.

### v10.1.1

- Fixed issue #900, found and reported by [Max Cohn](https://github.com/maxcohn).
  - Do not set `nullable` property to the depictions having no `type` property according to OpenAPI specification.
  - Affected schemas: `z.any()` and `z.preprocess()`.

```yaml
schema: z.any()
before:
  format: any
  nullable: true
after:
  format: any
```

### v10.1.0

- Feature #876: Supporting `z.lazy()` (including circular schemas) for the client generator.
  - This is an addition to the feature #856 released in version 9.3.0.

### v10.0.0

- **BREAKING** changes:
  - `Client::constructor()` now requires an object argument having `routing` property.
  - The feature method `withMeta` _(introduced in v2.1.0)_ used to mutate its argument (`zod` schema) in order to
    extend it with additional methods.
  - If you're using this feature _within_ the call of `EndpointsFactory::build()`, there is no issue.
  - However, if you're using a schema assignment (to some const) along with this method, this might lead to unexpected
    results.
  - The following case is reported by [@McMerph](https://github.com/McMerph) in issue #827.
    - Reusing a schema assigned to a const for its several wrappings by `withMeta` and setting different examples.
    - In this case all examples were set to the original const.
  - This release fixes that behavior by making `withMeta` immutable: it returns a new copy of its argument.
  - `zod` becomes a peer dependency, fixes issue #822.
    - You need to install it manually and adjust your imports accordingly.
  - `express` becomes a peer dependency as well.
    - You need to install it manually.
  - `typescript` becomes an optional peer dependency.
    - When using a client generator, you need to install it manually.
    - The minimal supported version is 4.9.3.
  - Proprietary schemas are now exported under the namespace `ez`.
    - Imports and utilization should be adjusted accordingly.
    - Affected schemas: `file`, `dateIn`, `dateOut`, `upload`.
  - If facing Typescript errors `TS4023` or `TS4094`, ensure disabling `declaration` option in your `tsconfig.json`.
  - The minimal Node version is now 14.18.0.
  - Due to switching to `tsup` builder, the file structure has changed:
    - `/dist/index.js` — CommonJS bundle;
    - `/dist/esm/index.js` — ESM bundle;
    - `/dist/index.d.ts` — types declaration bundle.

```ts
// before
new Client(routing).print();
// after
new Client({ routing }).print();
```

```ts
// the example case
const originalSchema = z.string();
const schemaA = withMeta(originalSchema).example("A");
const schemaB = withMeta(originalSchema).example("B");
// BEFORE: all three const have both examples "A" and "B"
// AFTER:
// - originalSchema remains intact
// - schemaA has example "A"
// - schemaB has example "B"
```

```ts
// before
import { z } from "express-zod-api";
const stringSchema = z.string();
const uploadSchema = z.upload();
```

```ts
// after
import { z } from "zod"; // module changed
import { ez } from "express-zod-api"; // new namespace
const stringSchema = z.string(); // remains the same
const uploadSchema = ez.upload(); // namespace changed
```

## Version 9

### v9.4.2

- Fixed issue #892, found and reported by [@McMerph](https://github.com/McMerph).
  - Several examples for Array-Like schemas (`z.array()` and `z.tuple()`) used to be merged in the generated documentation due to the bug in `getExamples()` method.

### v9.4.1

- Fixing the example implementation for the generated client in case of `DELETE` method.
  - Since v9.0.0-beta1 request `body` is no longer accepted (by default) as an input source.
  - The example implementation is now aligned accordingly to use query parameters.

### v9.4.0

- Feature #875, proposed by [@VideoSystemsTech](https://github.com/VideoSystemsTech).
  - Ability to document the API specification keeping the schemas organized within named components.
  - `OpenAPI::constructor()` is equipped with a new optional property `composition` that can be:
    - `inline` (default) — schemas are depicted directly in a place of their usage;
    - `components` (feature) — schemas are depicted within the `components` section and have references by their names.

```ts
// example usage
new OpenAPI({
  routing,
  config,
  version: "1.2.3",
  title: "My API",
  serverUrl: "https://example.com",
  composition: "components", // <——
}).getSpecAsYaml();
```

### v9.3.1

- Hotfix for the feature #856
  - `$ref` is equipped with the required prefix: `#/components/schemas/`;
  - The issue reported by [@TheWisestOne](https://github.com/TheWisestOne).

```yaml
before:
  $ref: 2048581c137c5b2130eb860e3ae37da196dfc25b
after:
  $ref: "#/components/schemas/2048581c137c5b2130eb860e3ae37da196dfc25b"
```

### v9.3.0

- Feature #856, proposed by [@TheWisestOne](https://github.com/TheWisestOne) in discussion #801.
  - Supporting `z.lazy()` in the documentation generator (OpenAPI), including circular schemas.
  - The feature is only available for the OpenAPI generator, it's not available for the client generator yet.
  - OpenAPI references are utilized in order to limit the possible recursion.
  - A new optional property added to the constructor of the OpenAPI class:
    - `serializer` is the function that accepts a schema and returns its unique identifier in order to compare them.
    - When omitted, the default one used, which is `JSON.stringify()` + `SHA1` hash as a `hex` digest.
    - If/when it's not enough precise, consider specifying your own implementation.

```yaml
schema: z.lazy()
before:
  error: Zod type ZodLazy is unsupported
after:
  schema:
    type: object
    properties:
      lazyProperty:
        $ref: 2048581c137c5b2130eb860e3ae37da196dfc25b # sample reference
  components:
    schemas:
      2048581c137c5b2130eb860e3ae37da196dfc25b:
        type: array
        items:
          $ref: 2048581c137c5b2130eb860e3ae37da196dfc25b # circular reference
```

### v9.2.1

- `zod` version is 3.21.4.

### v9.2.0

- `zod` version is 3.21.2.
  - `ulid` string format support added.

### v9.1.0

- `zod` version is 3.21.0
  - General support of the following string formats in the documentation: `cuid2`, `ip`, `emoji`.

### v9.0.0

- **BREAKING** changes:
  - `createApiResponse()` method is removed. Read the release notes to v8.11.0 for migration strategy.
- Potentially **BREAKING** changes:
  - The following changes correspond to the entities that are not supposed to be used directly, however they are public.
  - `Endpoint::constructor()`
    - `mimeTypes` property is removed from the argument.
  - `Endpoint` public methods replaced:
    - `getPositiveStatusCode()` —> `getStatusCode("positive")`
    - `getNegativeStatusCode()` —> `getStatusCode("negative")`
    - `getInputSchema()` —> `getSchema("input")`
    - `getOutputSchema()` —> `getSchema("output")`
    - `getPositiveResponseSchema()` —> `getSchema("positive")`
    - `getNegativeResponseSchema()` —> `getSchema("negative")`
    - `getInputMimeTypes()` —> `getMimeTypes("input")`
    - `getPositiveMimeTypes()` —> `getMimeTypes("positive")`
    - `getNegativeMimeTypes()` —> `getMimeTypes("negative")`
  - Fixed problem #787, reported and resolved by [@TheWisestOne](https://github.com/TheWisestOne).
    - Validation errors thrown from within the Middlewares and Endpoint handlers unrelated to the IO do now lead to the
      status code `500` instead of `400`, when you're using the `defaultResultHandler` or `defaultEndpointsFactory`.
      - It enables you to use zod (via the exposed `z` namespace) for the internal needs of your implementation, such as
        validating the data coming from your database, for example.
    - Historically, `ZodError` meant the error related to the input validation, but it's changed.
      - New error class created: `InputValidationError`.
      - If you have a custom `ResultHandler` that relies on `ZodError` for responding with `400` code, you need to
        change that condition to `InputValidationError` in order to keep that behaviour.
    - Luckily, the following entities were exposed and became available for the convenience of your migration:
      - `OutputValidationError`,
      - `InputValidationError` _(new)_,
      - `getMessageFromError()`,
      - `getStatusCodeFromError()`.
    - Consider using `getStatusCodeFromError()` inside your custom `ResultHandler`, or make the following changes:
  - Fixed issue #820, reported and resolved by [@McMerph](https://github.com/McMerph).
    - Request `body` is no longer considered as an input source for `DELETE` request.
    - Despite the fact that this method MAY contain `body` (it's not explicitly prohibited), it's currently considered
      a bad practice to rely on it. Also, it led to a syntax error in the generated documentation according to OpenAPI
      3.0 specification.
    - In case you have such Endpoints that rely on inputs collected from `DELETE` request body and want to continue,
      add the following property to your configuration in order to keep the previous behavior without changes to your
      implementation.
    - Read the [customization instructions](README.md#customizing-input-sources).

```typescript
// Your custom ResultHandler
// Before: if you're having an expression like this:
if (error instanceof z.ZodError) {
  response.status(400);
}
// After: replace it to this:
if (error instanceof InputValidationError) {
  response.status(400);
}
// Or: consider the alternative:
const statusCode = getStatusCodeFromError(error);
const message = getMessageFromError(error);
response.status(statusCode);
```

```yaml
inputSources: { delete: ["body", "query", "params"] }
```

## Version 8

### v8.11.0

- Feature #824, proposed by [@McMerph](https://github.com/McMerph).
  - In your custom `ResultHandler` you can now specify the status codes used for positive and negative responses.
  - This declarative information is used for generating a better documentation on your API.
- Declaring API Response for `ResultHandler` made easier.
  - When responding with JSON, `getPositiveResponse` and `getNegativeResponse` can now just return the schema.
  - For any customizations on MIME types and status codes those methods of your custom `ResultHandler` implementation
    should return object with corresponding optional properties: `mimeType` (or `mimeTypes`) and `statusCode`.
  - `mimeType` overrides `mimeTypes` when both are specified.
  - The `createApiResponse()` method is deprecated and will be removed in next major release.

```typescript
// JSON responding ResultHandler Example
// before
createResultHandler({
  getPositiveResponse: (output: IOSchema) =>
    createApiResponse(z.object({ data: output })),
  getNegativeResponse: () => createApiResponse(z.object({ error: z.string() })),
});
// after
createResultHandler({
  getPositiveResponse: (output: IOSchema) => z.object({ data: output }),
  getNegativeResponse: () => z.object({ error: z.string() }),
});
```

```typescript
// Example on customizing MIME types and status codes
// before
createResultHandler({
  getPositiveResponse: () => createApiResponse(z.file().binary(), "image/*"),
  getNegativeResponse: () => createApiResponse(z.string(), "text/plain"),
});
// after
createResultHandler({
  getPositiveResponse: () => ({
    schema: z.file().binary(),
    mimeType: "image/*",
    statusCode: 201,
  }),
  getNegativeResponse: () => ({
    schema: z.string(),
    mimeType: "text/plain",
    statusCode: 403,
  }),
});
```

### v8.10.0

- Feature #845, proposed by [@lazylace37](https://github.com/lazylace37).
  - Equipping the generated documentation with automatically generated and unique `operationId`.
  - The `operationId` consists of method, path and optional numeric suffix.

```yaml
before:
  paths:
    /v1/user/retrieve:
      get:
        responses:
after:
  paths:
    /v1/user/retrieve:
      get:
        operationId: GetV1UserRetrieve
        responses:
```

### v8.9.4

- `openapi3-ts` version is 3.2.0.

### v8.9.3

- `zod` version is 3.20.6.

### v8.9.2

- Fixed issue #816 (related to discussion #803), reported and resolved by [@McMerph](https://github.com/McMerph).
  - Assigning a singular `Security` schema to a `Middleware` led to an error during the generation of OpenAPI docs.
  - Also, preventing the `required` prop to be an empty array when depicting objects and records in OpenAPI docs.

### v8.9.1

- Fixed issue #805, reported and resolved by [@TheWisestOne](https://github.com/TheWisestOne).
  - The frontend client generator was failing to generate a valid code in case of a routing path having multiple non-alphanumeric characters.

### v8.9.0

- Fixes of the documentation generator (OpenAPI).
  - Transformations in the `output` schema:
    - If failed to figure out their output type, now depicted as `any`.
    - No excessive properties are inherited from their input types.
- Improvements of the frontend client generator
  - Achieving the similarity with the OpenAPI generator.
  - Transformations in the `output` schema are not recognized and typed, similar to OpenAPI generator.
  - The `coerce` feature in output schema now does not lead to marking the property as optional.

### v8.8.2

- No new features, no any fixes.
- Just a technical release due to the upgrade of many dev dependencies.

### v8.8.1

- Fixed a bug introduced in v8.6.0.
  - The list of required object properties was depicted incorrectly by the OpenAPI generator in case of using the new
    `coerce` feature in the response schema.

```typescript
// reproduction example
const endpoint = defaultEndpointsFactory.build({
  // ...
  output: z.object({
    a: z.string(),
    b: z.coerce.string(),
    c: z.coerce.string().optional(),
  }),
});
```

```yaml
before:
  required:
    - a
after:
  required:
    - a
    - b
```

### v8.8.0

- First step on generating better types from your IO schemas for the frontend client.
  - I rewrote and refactored the functionality of `zod-to-ts` within the library.
  - Using the abstract schema walker I made in the previous release.
  - In general, I'm aiming to achieve the consistency between OpenAPI and Client generators.
  - So far only minor improvements were made according to the specific needs of the library.
  - The following schemas are no longer supported by client generator, since they are not transmittable:
    - `ZodUndefined`, `ZodMap`, `ZodSet`, `ZodPromise`, `ZodFunction`, `ZodLazy`, `ZodVoid`, `ZodNever`, `ZodDate`.
    - From now on they are described as `any`.
  - In opposite, the following schemas are now supported:
    - `ZodNativeEnum` (similar to `ZodEnum`), `ZodCatch`, `ZodBranded`, `ZodPipeline`.
  - Additionally, the representation of some schemas have been changed slightly:

```typescript
interface Changes<T> {
  ZodFile: {
    before: any;
    after: string;
  };
  ZodRecord: {
    before: { [x: string]: T };
    after: Record<string, T>;
  };
}
```

### v8.7.0

- No new features, no any fixes.
- However, the routing initialization and the schema documenting processes have been refactored.
  - Some properties in the documentation may change their order, but the overall depiction should remain.

### v8.6.0

- `zod` version is 3.20.2.
- OpenAPI docs generator supports the following new features:
  - `ZodCatch`;
  - `z.string().datetime()` including `offset` option;
  - `z.string().length()`;
  - `ZodPipeline`;
  - `coerce` option available on `ZodString, ZodNumber, ZodBigInt, ZodBoolean` and `ZodDate`.

### v8.5.0

- Supporting Node 19.
- `@express-zod-api/zod-to-ts` version is v1.1.6.
- Custom errors have gotten their well deserved names matching their classes.
  - The list of currently exposed custom errors: `OpenAPIError, DependsOnMethodError, RoutingError`.
- Output validation errors now cause HTTP status code `500` instead of `400`.
  - HTTP status codes `4xx` are supposed to reflect client errors (bad requests).
  - The case when Endpoint's handler returns do not comply the Endpoint's output schema is the internal API error.
  - Use [Typescript's strict mode](https://www.typescriptlang.org/tsconfig#strict) in order to prevent such cases
    during the development.
- Added [Code of Conduct](CODE_OF_CONDUCT.md).
- Output validation error messages changed slightly in the response:

```text
// before:
output: Invalid format; anything: Number must be greater than 0
// after:
output/anything: Number must be greater than 0
```

### v8.4.4

- `typescript` version is 4.9.4.
- Following the changes made in v8.4.2, I'm switching to the [forked zod-to-ts](https://github.com/RobinTail/zod-to-ts)
  - Typescript made a regular dependency inside that fork, since it's used for code generation.
  - `@express-zod-api/zod-to-ts` version is v1.1.5.
  - Fixed all warnings while generating a frontend client.

### v8.4.3

- The regular expression used for validating `z.dateIn()` made easier
  by [@niklashigi](https://github.com/niklashigi).

```typescript
const before = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/;
const after = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/;
```

### v8.4.2

- Fixing issue of inability to generate Client having Typescript 4.1-4.6.x installed.
  - Making Typescript a regular dependency of the library (it was dev + peer).
  - Using `typescript` version 4.9.3.
  - This version also partially fixes the deprecation warnings in case you're using Typescript 4.9.x.
  - The issue introduced in version 7.9.1 of the library due to changing the implementation in accordance with the
    `typescript` upgrade to v4.8.2.
  - The library uses Typescript's factory methods to generate the frontend client.

### v8.4.1

- `openapi3-ts` version is 3.1.2.
- Fixed a bug found and reported by [@leosuncin](https://github.com/leosuncin) in issue #705.
  - CORS didn't work well in case of using `DependsOnMethod`.
  - The list of the allowed methods in the response to `OPTIONS` request did only contain the first method declared
    within `DependsOnMethod` instance.

```typescript
// reproduction minimal setup
const routing: Routing = {
  test: new DependsOnMethod({
    get: getEndpoint,
    post: postEndpoint,
  }),
};
// when requesting OPTIONS for "/test", the response has the following header:
// Access-Control-Allow-Methods: GET, OPTIONS
```

### v8.4.0

- Fixed the flaw found and reported by [@kirdk](https://github.com/kirdk) in issue #662.
  - Now nested top level refinements are available:

```ts
import { z } from "express-zod-api";

const endpoint = endpointsFactory.build({
  input: z
    .object({
      /* ... */
    })
    .refine(() => true)
    .refine(() => true)
    .refine(() => true),
  // ...
});
```

### v8.3.4

- Adjustments to the feature #600: Top level refinements.
  - In some cases the type of refinement can be indistinguishable from the type of transformation, since both of them
    are using the same class `ZodEffects` and the only difference is the _inequality_ if input and output types.
  - However, both of these types may have a common ancestor, which make it challenging to recognize them on the level
    of Types. So I made a decision to handle this case programmatically.
  - `createMiddleware()` and `Endpoint::constructor()` will throw in case of using `.transform()` on the top level of
    `IOSchema`.

```ts
// ZodEffects<ZodObject<{}>, boolean, {}>
z.object({}).transform(() => true); // OK, this is catchable
// ZodEffects<ZodObject<{}>, never[], {}>
z.object({}).transform(() => []); // never[] inherits Array inherits Object, {} inherits Object as well
```

### v8.3.3

- Fixed the bug #672 found and reported by [@niklashigi](https://github.com/niklashigi).
  - Preserving the custom description of `z.dateIn()` and `z.dateOut()` schemas when generating OpenAPI documentation.

```yaml
schema: z.dateIn().describe("custom description")
before:
  description: YYYY-MM-DDTHH:mm:ss.sssZ
after:
  description: custom description
```

### v8.3.2

- Fixed the bug #673 found and reported by [@niklashigi](https://github.com/niklashigi).
  - Preventing double parsing of incoming data by input schemas of middlewares containing transformations.
  - The bug caused inability of using any transforming schema in middlewares.
  - In particular, but not limited with: using `z.dateIn()` in middlewares.
    - Sample error message in this case: `Expected string, received date`.
  - Using `.transform()` method in middlewares was also affected by this bug.

### v8.3.1

- Clearer error message when using `z.date()` within I/O schema thrown by OpenAPI generator.

### v8.3.0

- Feature #600: Top level refinements.
  - Starting this version you can use the `.refine()` method on the `z.object()` of the input schema;
  - This feature might be useful, for example, when you have multiple optional properties on the top level, but at
    least one of them has to be specified;
  - Currently, only the refinements of `z.object()` are supported:
    - You can not combine it with `z.union()`, `z.intersetion()`, `z.discriminatedUnion()`, `.or()`, `.and()` yet;
  - The feature suggested by [@johngeorgewright](https://github.com/johngeorgewright)
    and [ssteuteville](https://github.com/ssteuteville).

```typescript
// example
import { z } from "express-zod-api";

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
  // ...
});
```

### v8.2.1

- OpenAPI generator throws when attempting to use `z.file()` within input schema.

### v8.2.0

- Feature #637: endpoint short description (summary).
  - Added the ability to assign a `shortDescription` to endpoints.
  - One sentence of no more than 50 characters is implied.
  - This text is substituted into the `summary` property of the generated documentation.
  - Visualizers of the generated OpenAPI documentation nicely display this text on the same line as the endpoint path.
  - If a `shortDescription` is not specified, but a regular `description` is, then by default the `summary` will be
    generated from the `description` by trimming.
  - You can optionally disable this behavior with the new option `hasSummaryFromDescription` of the `OpenAPI` generator.

```typescript
const exampleEndpoint = yourEndpointsFactory.build({
  // ...
  description: "The detailed explanaition on what this endpoint does.",
  shortDescription: "Retrieves the user.",
});
```

### v8.1.0

- Feature #571: tagging the endpoints.
  - Good news dear community! You can now tag your endpoints using the new properties of the `.build()` method
    of the `EndpointsFactory`;
  - For your convenience and for the sake of Semantics, there are singular and plural properties: `tag` and `tags`;
  - By default, these properties allow any string, so in order to enforce restrictions and achieve the consistency
    across all endpoints, the possible tags should be declared in the configuration first and also a brand
    new `EndpointsFactory` instantiation approach is required;
  - The configuration has got a new `tags` property for declaring possible tags and their descriptions;
  - Tags are an important part of the generated documentation for the OpenAPI standard;
  - The feature suggested by [@TheWisestOne](https://github.com/TheWisestOne).
- The property `scopes` (introduced in v7.9.0) has got its singular variation `scope`.

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
  config,
});

const exampleEndpoint = taggedEndpointsFactory.build({
  // ...
  tag: "users", // or tags: ["users", "files"]
});
```

### v8.0.2

- `express` version is 4.18.2.
- `openapi3-ts` version is 3.1.0.

### v8.0.1

- `zod` version is 3.19.1.

### v8.0.0

- **Breaking changes**:
  - Removed the signature deprecated in v7.6.1:
    - The argument of `EndpointsFactory::addMiddleware()` has to be the result of `createMiddleware()`;
  - Only the following Node versions are supported: ^14.17.0, ^16.10.0, ^18.0.0.
- `winston` version is 3.8.2.
- `zod` version is 3.19.0.
- `openapi3-ts` version is 3.0.2.
- Supporting `jest` (optional peer dependency) version 29.x.

## Version 7

### v7.9.4

- This version contains a cherry-picked fix made in v8.4.1.
- Fixed a bug found and reported by [@leosuncin](https://github.com/leosuncin) in issue #705.
  - CORS didn't work well in case of using `DependsOnMethod`.
  - The list of the allowed methods in the response to `OPTIONS` request did only contain the first method declared
    within `DependsOnMethod` instance.

```typescript
// reproduction minimal setup
const routing: Routing = {
  test: new DependsOnMethod({
    get: getEndpoint,
    post: postEndpoint,
  }),
};
// when requesting OPTIONS for "/test", the response has the following header:
// Access-Control-Allow-Methods: GET, OPTIONS
```

### v7.9.3

- This version contains a cherry-picked fix made in v8.3.2.
- Fixed the bug #673 found and reported by [@niklashigi](https://github.com/niklashigi).
  - Preventing double parsing of incoming data by input schemas of middlewares containing transformations.
  - The bug caused inability of using any transforming schema in middlewares.
  - In particular, but not limited with: using `z.dateIn()` in middlewares.
    - Sample error message in this case: `Expected string, received date`.
  - Using `.transform()` method in middlewares was also affected by this bug.

### v7.9.2

- Fixed issue #585 reported along with a suggested solution by [@foxfirecodes](https://github.com/foxfirecodes).
  - In case you need to `throw` within an `Endpoint`'s handler or a `Middleware`, consider
    [the best practice](https://eslint.org/docs/latest/rules/no-throw-literal) of only
    throwing an `Error` or a _descendant_ that extends the `Error`.
  - You can also `import { createHttpError } from "express-zod-api"` and use it for that purpose.
  - However, this version fixes the issue caused by throwing something else.
  - In this case that entity will be stringified into a `.message` of `Error`.
  - The issue manifested itself as a positive API response without data.

```typescript
// reproduction example
const myEndpoint = defaultEndpointsFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({}),
  handler: async () => {
    throw "I'm not an Error";
  },
});
```

```json lines
// response before:
{"status":"success"}
// response after:
{"status":"error","error":{"message":"I'm not an Error"}}
```

### v7.9.1

- Minor refactoring in order to support the recently released Typescript 4.8.2.

### v7.9.0

- Feature #540, an addition to the [#523](#v770): OAuth2 authentication with scopes.
  - Middlewares utilizing the OAuth2 authentication (via `security` property) can now specify the information on their
    flows including scopes.
  - Endpoints utilizing those middlewares can now specify their `scopes`.

```typescript
import { createMiddleware, defaultEndpointsFactory, z } from "express-zod-api";

// example middleware
const myMiddleware = createMiddleware({
  security: {
    type: "oauth2",
    flows: {
      password: {
        tokenUrl: "https://some.url",
        scopes: {
          read: "read something", // scope: description
          write: "write something",
        },
      },
    },
  },
  input: z.object({}),
  middleware: async () => ({
    /* ... */
  }),
});

// example endpoint
const myEndpoint = defaultEndpointsFactory.addMiddleware(myMiddleware).build({
  scopes: ["write"], // <——
  method: "post",
  input: z.object({}),
  output: z.object({}),
  handler: async () => ({
    /* ... */
  }),
});
```

### v7.8.1

- This version should fix the issue #551:
  - Supporting the peer dependency for `jest` version 28.

### v7.8.0

- `zod` version 3.18.0.
  - There is a new feature — [branded types](https://github.com/colinhacks/zod#brand).
  - `ZodBranded` is supported by OpenAPI generator.

### v7.7.0

- Feature #523: Ability to specify Security schemas of your Middlewares and depict the Authentication of your API.
  - OpenAPI generator now can depict the [Authentication](https://swagger.io/docs/specification/authentication/) of your
    endpoints as a part of the generated documentation.
  - There is a new optional property `security` of `createMiddleware()`.
  - You can specify a single or several security schemas in that property.
  - For several security schemas `security` support a new `LogicalContainer` that can contain upto 2 nested levels.
  - Supported security types: `basic`, `bearer`, `input`, `header`, `cookie`, `openid` and `oauth2`.
  - OpenID and OAuth2 security types are currently have the limited support: without scopes.

```typescript
// example middleware
import { createMiddleware } from "express-zod-api";

const authMiddleware = createMiddleware({
  security: {
    // requires the "key" in inputs and a custom "token" headers
    and: [
      { type: "input", name: "key" },
      { type: "header", name: "token" },
    ],
  },
  input: z.object({
    key: z.string().min(1),
  }),
  middleware: async ({ input: { key }, request }) => {
    if (key !== "123") {
      throw createHttpError(401, "Invalid key");
    }
    if (request.headers.token !== "456") {
      throw createHttpError(401, "Invalid token");
    }
    return { token: request.headers.token };
  },
});

// another example with logical OR
createMiddleware({
  security: {
    // requires either input and header OR bearer header
    or: [
      {
        and: [
          { type: "input", name: "key" },
          { type: "header", name: "token" },
        ],
      },
      {
        type: "bearer",
        format: "JWT",
      },
    ],
  },
  //...
});
```

### v7.6.3

- [@foxfirecodes](https://github.com/foxfirecodes) fixed the types resolution in the ESM build for the `nodenext` case.

### v7.6.2

- `zod` version is 3.17.10.

### v7.6.1

- Fixed issue #514: native express middlewares did not run for `OPTIONS` requests.
  - Using `.addExpressMiddleware()` or its alias `.use()` of `EndpointsFactory` it did not work for requests having
    `OPTIONS` method.
  - This version introduces the difference between a proprietary and native express middlewares.
    - Please ensure usage of the `.addMiddleware()` method along with `createMiddleware()`.
    - For the backward compatibility `.addMiddleware()` temporary also accepts the same arguments that
      `createMiddleware()` does, however this is deprecated and will be removed later.
  - Only native express middlewares are executed for `OPTIONS` request.
  - It makes it possible to use `cors` package (express middleware), which is described in the
    [Documentation](README.md#using-native-express-middlewares).
    - **Please note:** If using both `cors` package (express middleware) and `cors` configuration option, the
      configuration option sets CORS headers first, so the middleware can override them if needed.

```typescript
import { defaultEndpointsFactory } from "express-zod-api";
import cors from "cors";

const myFactory = defaultEndpointsFactory.addExpressMiddleware(
  cors({ credentials: true }),
);
```

### v7.6.0

- `zod` version is 3.17.9.
  - Some new public methods have been introduced, so I'm changing the minor version.

### v7.5.0

- Feature #503: configurable CORS headers:
  - The configuration options `cors` now accepts a function that returns custom headers;
  - The function may be asynchronous;
  - Setting `cors: true` implies the default headers;
  - The feature suggested by [@HardCoreQual](https://github.com/HardCoreQual).

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  // ...
  cors: ({ defaultHeaders, request, endpoint, logger }) => ({
    ...defaultHeaders,
    "Access-Control-Max-Age": "5000",
  }),
});
```

```yaml
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: ..., OPTIONS # endpoint methods + OPTIONS
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 5000
```

### v7.4.1

- There was an issue with logger when calling its methods without a message.
  The output was empty, considering the first argument to be a message.
  It's fixed in this version by adding `[No message]` message before printing the object.

```typescript
// reproduction example
logger.debug({ something: "test" });
```

### v7.4.0

- `winston` version is 3.8.1.

### v7.3.1

- `zod-to-ts` version is 1.1.1.
  - descriptions of the properties in the generated client.

### v7.3.0

- `express-fileupload` version is 1.4.0.
  - `busboy` upgraded from 0.3.1 to 1.6.0.
- `zod` version is 3.17.3.

### v7.2.0

- `zod` version is 3.17.2.
  - `z.string()` schema now has `.trim()` method.

### v7.1.1

- `zod` version is 3.16.1.

### v7.1.0

- Supporting Node 18.

### v7.0.0

- The deprecated methods and utility types have been removed:
  - `markOutput(), EndpointInput<>, EndpointOutput<>, EndpointResponse<>`.
- In case you've been using these entities for informing the Frontend on types of your endpoints, here is what you
  need to do in order to migrate:
  - Replace `markOutput(output)` with just `output` in your custom result handlers;
  - Replace the type signature of `getPositiveResponse()` method of your custom result handlers:
    - from `getPositiveResponse: <OUT extends IOSchema>(output: OUT) => {...}`
    - to `getPositiveResponse: (output: IOSchema) => {...}`
  - Replace usage of the utility types to the generated Frontend Client:
    - See Readme file on how to do it.

## Version 6

### v6.2.1

- `zod` version is 3.16.0.

### v6.2.0

- The following methods and utility types have been marked as deprecated:
  - `markOutput()`,
  - `EndpointInput<>`,
  - `EndpointOutput<>`,
  - `EndpointResponse<>`.
- These entities were used for informing the Frontend on types of API endpoints.
- Instead, consider the new approach on generating a Frontend Client (see Readme).

### v6.1.4

- `zod` version is 3.15.1.

### v6.1.3

- `express` version is 4.18.1.
- `zod-to-ts` version is 1.0.1.

### v6.1.2

- `express` version is 4.18.0.
  - Various new options and fixes.
- `zod-to-ts` version is 1.0.0.
  - The type of optional I/O parameters in the generated Client is aligned with `zod` definition.

```typescript
interface Before {
  foo: number | undefined;
}
interface After {
  foo?: number | undefined; // the question mark added
}
```

### v6.1.1

- Hotfix: capitalizing the method in example implementation (Client generator).

### v6.1.0

- Feature #403: API Client Generator:
  - A new way of informing the frontend about the I/O types of endpoints;
  - The new approach offers automatic generation of a client based on routing to a typescript file;
  - The generated client is flexibly configurable on the frontend side using an implementation function that
    directly makes requests to an endpoint using the libraries and methods of your choice;
  - The client asserts the type of request parameters and response;
  - Path params are excluded from `params` after being substituted;
  - The client now accepts a function parameter of `Implementation` type;
  - Its parameter `path` now contains substituted path params;
  - The feature suggested by [@hellovai](https://github.com/hellovai).

```typescript
// example client-generator.ts
import fs from "fs";
import { Client } from "express-zod-api";

fs.writeFileSync("./frontend/client.ts", new Client(routing).print(), "utf-8");
```

```typescript
// example frontend using the most simple Implementation based on fetch
import { ExpressZodAPIClient } from "./client.ts";

const client = new ExpressZodAPIClient(async (method, path, params) => {
  const searchParams =
    method === "get" ? `?${new URLSearchParams(params)}` : "";
  const response = await fetch(`https://example.com${path}${searchParams}`, {
    method: method.toUpperCase(),
    headers:
      method === "get" ? undefined : { "Content-Type": "application/json" },
    body: method === "get" ? undefined : JSON.stringify(params),
  });
  return response.json();
});

client.provide("get", "/v1/user/retrieve", { id: "10" });
```

### v6.0.3

- `zod` version is 3.14.4.
- `winston` version is 3.7.2.

### v6.0.2

- `zod` version is 3.14.3.

### v6.0.1

- `zod` version is 3.14.2.

### v6.0.0

- Technically this version contains all the same changes and improvements as 5.9.0-beta1.
- The new implementation of the `EndpointsFactory`, however, has more restrictive middleware input schema requirements.
- To avoid possible backward incompatibility issues, I have decided to publish these changes as a major release.
- In addition, the deprecated schema `z.date()` is no longer supported in documentation generator.
- The following changes are required to migrate to this version:
  - You cannot use the `.strict()`, `.passthrough()` and its deprecated alias `.nonstrict()` methods in middlewares.
  - Only `.strip()` is allowed in middlewares, which is actually default, so you should not use any of them at all.
  - Replace the `z.date()` with `z.dateIn()` in input schema and with `z.dateOut()` in output schema.
- Also, improvements have been made to the `EndpointsFactory`, in terms of combining the input schemas of
  middlewares and the endpoint itself. A custom type has been replaced with usage of `ZodIntersection` schema with
  respect to the originals.
- The generated documentation has improved in this regard:
  - Previously, fields from an object union were documented in a simplified way as optional.
  - Instead, it is now documented using `oneOf` OpenAPI notation.
- In addition, you can now also use the new `z.discriminatedUnion()` as the input schema on the top level.

```typescript
// how to migrate
export const myMiddleware = createMiddleware({
  input: z
    .object({
      key: z.string().nonempty(),
      at: z.date(), // <— replace with z.dateIn()
    })
    .passthrough(), // <— remove this if you have it in your code
  middleware: async () => ({...}),
});
```

```typescript
// example
const endpoint = defaultEndpointsFactory.build({
  method: "post",
  input: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      str: z.string()
    }),
    z.object({
      type: z.literal("numeric"),
      num: z.number()
    }),
  ]),
  output: z.object({...}),
  handler: async ({ input }) => {
    // the type of the input:
    // | { type: "text", str: string }
    // | { type: "numeric", num: number }
  }
});
```

## Version 5

### v5.8.0

- `zod` version is 3.13.4.
  - There is a new schema `z.nan()` and some fixes.

### v5.7.0

- `zod` version is 3.12.0.
  - There is a new schema `z.discriminatedUnion()` and various fixes.

### v5.6.1

- `express` version is 4.17.3.
- `openapi3-ts` version is 2.0.2.

### v5.6.0

- Feature #311. `EndpointsFactory::addExpressMiddleware()` or its alias `use()`.
  - A method to connect a native (regular) `express` middleware to your endpoint(s).
  - You can connect any middleware that has a regular express middleware signature
    `(req, res, next) => void | Promise<void>` and can be supplied to `app.use()`.
  - You can also specify a provider of options for endpoint handlers and next middlewares.
  - You can also specify an error transformer so that the `ResultHandler` would send the status you need.
    - In case the error is not a `HttpError`, the `ResultHandler` will send the status `500`.

```typescript
import { defaultEndpointsFactory, createHttpError } from "express-zod-api";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";

const simpleUsage = defaultEndpointsFactory.addExpressMiddleware(
  cors({ credentials: true }),
);

const advancedUsage = defaultEndpointsFactory.use(auth(), {
  provider: (req) => ({ auth: req.auth }), // optional, can be async
  transformer: (err) => createHttpError(401, err.message), // optional
});
```

### v5.5.6

- `winston` version is 3.6.0.

### v5.5.5

- `winston-transport` version is 4.5.0.

### v5.5.4

- `express-fileupload` version is 1.3.1.

### v5.5.3

- `winston` version is 3.5.1.
- I made a website for the library available on following domains:
  - [https://ez.robintail.cz](https://ez.robintail.cz) and
  - [https://express-zod-api.vercel.app](https://express-zod-api.vercel.app).
  - Currently, it provides the documentation for each release in a way I find more suitable.

### v5.5.2

- `winston` version is 3.5.0.

### v5.5.1

- In this version, the OpenAPI documentation generator throws an error when using `z.upload()` within response schema.

### v5.5.0

- `z.date()` is deprecated for using within IO schemas of your API.
- Feature #297: `z.dateIn()` and `z.dateOut()` schemas.
  - Since `Date` cannot be passed directly in JSON format, attempting to return `Date` from the endpoint handler
    results in it being converted to an ISO `string` in actual response. It is also impossible to transmit the `Date`
    in its original form to your endpoints within JSON. Therefore, there is confusion with original method `z.date()`.
  - In order to solve this problem, the library provides two custom methods for dealing with dates: `z.dateIn()` and
    `z.dateOut()` for using within input and output schemas accordingly.
  - `z.dateIn()` is a transforming schema that accepts an ISO `string` representation of a `Date`, validates it, and
    provides your endpoint handler or middleware with a `Date`.
  - `z.dateOut()`, on the contrary, accepts a `Date` and provides `ResultHanlder` with a `string` representation in ISO
    format for the response transmission.

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

### v5.4.2

- `ramda` version is 0.28.0.
- The header `X-Powered-By: Express` has been removed according to
  [recommendations](https://expressjs.com/en/advanced/best-practice-security.html).

### v5.4.1

- Listing the following types as the regular dependencies since certain exported methods refer to them:
  `@types/compression, @types/express, @types/express-fileupload, @types/http-errors, @types/node`.
- Here is the information that underlies this decision:
  - https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#dependencies
  - https://github.com/DefinitelyTyped/DefinitelyTyped/issues/44777#issuecomment-629660992

### v5.4.0

- Feature #281: Response compression.
  - You can enable and configure the response compression using the new option `compression` in server configuration
    when using `createServer()` method.
  - In order to receive the compressed response the client should include the following header in the request:
    `Accept-Encoding: gzip, deflate`.
  - Only responses with compressible content types are subject to compression.
  - There is also a default threshold of 1KB that can be configured.

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    // enabling and configuring the compression: bool or options
    compression: {
      threshold: "100b",
    },
    // other options
  },
});
```

### v5.3.3

- `ramda` version is 0.27.2.
- `winston` version is 3.4.0.
  - The version of dependent package `colors` has been strictly set to 1.4.0.
  - More about this incident here: https://github.com/winstonjs/winston/pull/2008

### v5.3.2

- No changes.

### v5.3.1

- Fixed issue #269: async refinements in I/O schemas of endpoints and middlewares.
  - There was an error `Async refinement encountered during synchronous parse operation. Use .parseAsync instead.`

### v5.3.0

- Supporting Node 17.

### v5.2.1

- Fixing the compatibility with `@types/node@17.0.7`.
  - Fixing the return type of `Endpoint::execute()` in case of `OPTIONS` method (it should be `void`).

### v5.2.0

- Feature #254: the ability to configure routes for serving static files:
  - Use `new ServeStatic()` with the same arguments as `express.static()`;
  - You can find the documentation on these arguments here: http://expressjs.com/en/4x/api.html#express.static
  - The feature suggested by [@Isaac-Leonard](https://github.com/Isaac-Leonard).

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

### v5.1.0

- Feature #252: a helper method for testing your endpoints: `testEndpoint()`.
  - Requires `jest` (and optionally `@types/jest`) to be installed.
  - The method helps to mock the request, response, config and logger required to execute the endpoint.
  - The method executes the endpoint and returns the created mocks.
  - After that you only need to assert your expectations in the test.

```typescript
import { testEndpoint } from "express-zod-api";

test("should respond successfully", async () => {
  const { responseMock, loggerMock } = await testEndpoint({
    endpoint: yourEndpoint,
    requestProps: {
      method: "POST",
      body: { ... },
    },
  });
  expect(loggerMock.error).toHaveBeenCalledTimes(0);
  expect(responseMock.status).toHaveBeenCalledTimes(200);
  expect(responseMock.json).toHaveBeenCalledWith({
    status: "success",
    data: { ... },
  });
});
```

### v5.0.0

- **Breaking changes**: Instead of HTTP Server the method `createServer()` now returns an object with the following
  entities: `app, httpServer, httpsServer, logger`.
- Feat: the ability to configure and run an additional HTTPS server to process requests over a secure protocol:
  - This option is only available when using `createServer()` method.
- New configuration option `https`:

```typescript
import { createConfig } from "express-zod-api";

const config = createConfig({
  server: {
    listen: 80,
  },
  // enables HTTPS server as well
  https: {
    // at least "cert" and "key" options required
    options: {
      cert: fs.readFileSync("fullchain.pem", "utf-8"),
      key: fs.readFileSync("privkey.pem", "utf-8"),
    },
    listen: 443, // port or socket
  },
  // ...
});
```

## Version 4

### v4.2.0

- `express` version is 4.17.2.
- `http-errors` version is 2.0.0.

### v4.1.0

- Feature #230. The shorthand method `EndpointsFactory::addOptions()`.
  - You may find it useful in case you'd like to provide your Endpoint's handler with some entities that do not depend
    on Request, maybe a database connection instance of similar.
  - Under the hood the method creates a middleware with an empty input and attaches it to the factory.
  - The argument supplied to the method is available within `options` parameter of the Endpoint's `handler`.

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const newFactory = defaultEndpointsFactory.addOptions({
  db: mongoose.connect("mongodb://connection.string"),
  privateKey: fs.readFileSync("private-key.pem", "utf-8"),
});

const endpoint = newFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({}),
  handler: async ({ options }) => {
    return {}; // options: { db, privateKey }
  },
});
```

### v4.0.0

- The deprecated parameter `type` of `EndpointsFactory::build({...})` has been removed.
- The OpenAPI generator now requires `config` parameter to be supplied in `new OpenAPI({...})`.
- The OpenAPI generator takes into account possibly customized `inputSources` from `config`.

## Version 3

### v3.2.0

- Feature #204. Detecting usage of `z.upload()` within Endpoint's input schema automatically.
  - There is no longer need to specify `type: "upload"` for `EndpointsFactory::build({...})`.
  - In case you are using `z.upload()` in endpoint's input schema, inputs will be parsed by the
    `multipart/form-data` parser.
  - The optional parameter `type?: "json" | "upload"` of `build({...})` is deprecated.

### v3.1.2

- Fixed issue #202, originally reported in PR #201.
  - Using curly braces notation instead of colon for route path params in generated documentation according to
    OpenAPI / Swagger specification.
  - See "Path templating" at https://swagger.io/specification/.

```yaml
before: "/v1/user/:id"
after: "/v1/user/{id}"
```

### v3.1.1

- No changes. Releasing as 3.1.1 due to a typo in Readme I found after publishing 3.1.0.

### v3.1.0

- Feature #174: Route path params as the new input source.
  - `request.params` is validated against the input schema.
  - The schema for validating the path params can now be described along with other inputs.
  - You no longer need a middleware like `paramsProviderMiddleware` to handle path params.
  - The route path params are now reflected in the generated documentation.

```typescript
const routingExample: Routing = {
  v1: {
    user: {
      // route path /v1/user/:id, where :id is the path param
      ":id": getUserEndpoint,
    },
  },
};
const getUserEndpoint = endpointsFactory.build({
  method: "get",
  input: withMeta(
    z.object({
      // id is the route path param, always string
      id: z.string().transform((value) => parseInt(value, 10)),
      // other inputs (in query):
      withExtendedInformation: z.boolean().optional(),
    }),
  ).example({
    id: "12",
    withExtendedInformation: true,
  }),
  // ...
});
```

- The default configuration of `inputSources` has been changed.

```typescript
const newInputSourcesByDefault: InputSources = {
  get: ["query", "params"],
  post: ["body", "params", "files"],
  put: ["body", "params"],
  patch: ["body", "params"],
  delete: ["body", "query", "params"],
};
```

### v3.0.0

- **Warning**: There are breaking changes described below:
  - Minimum compatible Node version changed from ~~10~~ to 12.
  - The exports map restricts the possibility to import/require the package files to the entry points only.
  - The deprecated type `ConfigType` removed — please use `createConfig()` instead.
- The library is now distributed as a dual package containing both CJS (CommonJS) and ESM (ECMAScript Module).
- Mime version is 3.0.0.

## Version 2

### v2.10.2

- The version of http-errors is 1.8.1.

### v2.10.1

- Mime version is 2.6.0.
- Minor fix in importing Zod utility type.

### v2.10.0

- Feature #165. You can add examples to the generated documentation:
  - Introducing new method `withMeta()`. You can wrap any Zod schema in it, for example: `withMeta(z.string())`;
  - `withMeta()` provides you with additional methods for generated documentation. At the moment there is one so far:
    `withMeta().example()`;
  - You can use `.example()` multiple times for specifying several examples for your schema;
  - You can specify example for the whole IO schema or just for a one of its properties;
  - `withMeta()` can be used within Endpoint and Middleware as well. Their input examples will be merged for the
    generated documentation;
  - Check out the example of the generated documentation in the `example` folder;
  - Notice: `withMeta()` mutates its argument;
  - The feature suggested by [@digimuza](https://github.com/digimuza).

```typescript
import { defaultEndpointsFactory } from "express-zod-api";

const exampleEndpoint = defaultEndpointsFactory.build({
  method: "post",
  description: "example user update endpoint",
  input: withMeta(
    z.object({
      id: z.number().int().nonnegative(),
      name: z.string().nonempty(),
    }),
  ).example({
    id: 12,
    name: "John Doe",
  }),
  output: withMeta(
    z.object({
      name: z.string(),
      timestamp: z.number().int().nonnegative(),
    }),
  ).example({
    name: "John Doe",
    timestamp: 1235698995125,
  }),
  handler: async () => {},
});
```

### v2.9.0

- Zod version is 3.11.6.
- Feature #111. You can add description to any Zod schema, for example: `z.string().describe('Something')`.
  - You can add description to a whole I/O schema or its property.
  - This description will be included into the generated Swagger / OpenAPI documentation.

```yaml
example:
  parameters:
    - name: id
      in: query
      required: true
      schema:
        description: a numeric string containing the id of the user
        type: string
        pattern: /\d+/
```

### v2.8.2

- Zod version is 3.10.3.

### v2.8.1

- Fixed issue #169. Suddenly I found out that `yarn` does NOT respect `yarn.lock` files of sub-dependencies. So the
  version of `zod` defined in my `yarn.lock` file does not actually mean anything when doing `yarn add express-zod-api`.
  - The recently released version of Zod (3.10.x) seems to have some breaking changes, it should not be installed
    according to my lock file.
  - I'm locking the dependency versions in `package.json` file from now on.
  - `npm` users are also affected since the distributed lock file is for `yarn`.

### v2.8.0

- I did my best in order to improve the documentation and list the recently implemented features.
- Feature #158: ability to specify the input sources for each request method.
- New config option `inputSources` allows you to specify the properties of the request, that are combined into an
  input that is being validated and available to your endpoints and middlewares.

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

- For example, in case you need `query` along with `body` available to your endpoints handling POST requests, consider:

```typescript
createConfig({
  // ...,
  inputSources: {
    post: ["query", "body", "files"],
  },
});
```

- The order in array matters: last item has the highest priority in case of the same name properties.

### v2.7.0

- From now on, I want to express my support to trans people in the IT world.
  Transgender rights are human rights and all human beings are born free and equal in dignity.
  I believe that the problem of discrimination against the rights of trans people is not visible enough,
  so I add startup logo in this regard.
- However, you can turn it off with a simple setting:

```typescript
import {createConfig} from 'express-zod-api';

const config = createConfig({
  startupLogo: false,
  ...
});
```

### v2.6.0

- Zod version is 3.9.8.
  - It supports the ability to specify the key schema of `z.record()`.
  - In case of using enums and literals in the key schema they will be described as required ones in the generated
    OpenAPI / Swagger documentation.

```typescript
// example
z.record(
  z.enum(["option1", "option2"]), // keys
  z.boolean(), // values
);
```

- Feature #145: `attachRouting()` now returns the `logger` instance and `notFoundHandler`. You can use it with your
  custom express app for handling `404` (not found) errors:

```typescript
const { notFoundHandler } = attachRouting(config, routing);
app.use(notFoundHandler);
app.listen();
```

- Or you can use the `logger` instance with any `ResultHandler` for the same purpose:

```typescript
const { logger } = attachRouting(config, routing);
app.use((request, response) => {
  defaultResultHandler.handler({
    request,
    response,
    logger,
    error: createHttpError(404, `${request.path} not found`),
    input: null,
    output: null,
  });
});
app.listen();
```

### v2.5.2

- Fixed a bug due to which the API did not respond in case of an error within the `ResultHandler`.
  - In this case the `LastResortHandler` comes into play.
  - It sets the status code to `500` and sends out plain text with an error message.
  - It is not customizable yet, and it's meant to be kept very simple in case of JSON conversion errors.

### v2.5.1

- Fixed a bug due to which the execution of the code could continue despite the possible closing of the response
  stream by one of the middlewares.
  - Affected Node versions: below 12.9.0.

### v2.5.0

- New feature: file uploads!
- The processing of files is provided by `express-fileupload` which is based on `busboy`.
- Introducing the new schema: `z.upload()`.
- New configuration option:

```typescript
const config = createConfig({
  server: {
    upload: true,
    // or selected express-fileupload's options:
    // @see https://github.com/richardgirges/express-fileupload#available-options
    upload: {
      uploadTimeout: 60000,
      useTempFiles: true,
      safeFileNames: true,
      preserveExtension: 4,
      tempFileDir: "/var/tmp",
    },
  },
});
```

- Creating the `Endpoint`:

```typescript
const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: "post",
  type: "upload", // <- new option, required
  input: z.object({
    avatar: z.upload(),
  }),
  output: z.object({
    /* ... */
  }),
  handler: async ({ input: { avatar } }) => {
    // avatar: {name, mv(), mimetype, encoding, data, truncated, size, etc}
    // avatar.truncated is true on failure
    return {
      /* ... */
    };
  },
});
```

- The file upload currently supports requests having POST method and `multipart/form-data` content type.
- You can send other data and specify additional `input` parameters, including arrays and objects.
- Fixed the OPTIONS duplication issue in response header when `cors` option is enabled:

```yaml
before:
  Access-Control-Allow-Methods: POST, OPTIONS, OPTIONS
after:
  Access-Control-Allow-Methods: POST, OPTIONS
```

### v2.4.0

- Zod version is 3.8.2.
- Supporting new string format: `cuid`.
- Supporting new Zod schema `z.preprocess()`.
  Please avoid using it for Endpoint outputs.
- Supporting default values of optional properties in OpenAPI/Swagger documentation.

```typescript
// example
z.object({
  name: z.string().optional().default("John Wick"),
});
```

### v2.3.3

- Zod version is 3.7.3.
- Removed usage of the deprecated `ZodObject`'s method `.nonstrict()` in the example and Readme since it's not required.

### v2.3.2

- Zod version is 3.7.2.
- I've also updated it to `^3.7.2` in the `package.json` file in case of package manager issues.

### v2.3.1

- Fixed a type mismatch issue when the configuration is declared in a separate file using the `ConfigType`.
  - `ConfigType` is now deprecated _(will be removed in v3)_.
  - Please use helper function `createConfig()`.
  - This way it assigns the correct type for using configuration with `createServer()` and `attachRouting()`.

```typescript
// before
const configBefore: ConfigType = {
  server: {
    listen: 8090,
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
};
// after
export const configAfter = createConfig({
  server: {
    listen: 8090,
  },
  cors: true,
  logger: {
    level: "debug",
    color: true,
  },
});
```

### v2.3.0

- Changes and improvements of the generated Swagger / OpenAPI documentation:

```yaml
ZodArray: # z.array()
  before:
    type: array
    items:
      type: type # type of the array items
  after:
    type: array
    items:
      type: type
    minItems: value # optional, when z.array().min(value)
    maxItems: value # optional, when z.array().max(value)
ZodTuple: # z.tuple()
  before:
    error: unsupported
  after:
    type: array
    items:
      oneOf: [] # schemas of the tuple items
    minItems: value # number of items in the tuple
    maxItems: value # number of items in the tuple
    description: "0: type, 1: type, etc"
```

### v2.2.0

- Changes and improvements of the generated Swagger / OpenAPI documentation:

```yaml
ZodBigInt: # z.bigint()
  before:
    type: integer
    format: int64
  after:
    type: integer
    format: bigint
ZodNumber: # z.number()
  before:
    type: number
  after:
    type: number | integer # when z.number().int()
    format: double | int64 # when z.number().int()
    # MIN_VALUE or MIN_SAFE_INTEGER of Number or z.number().min(value)
    minimum: 5e-324 | -9007199254740991 | value
    # MAX_VALUE or MAX_SAFE_INTEGER of Number or z.number().max(value)
    maximum: 1.7976931348623157e+308 | 9007199254740991 | value
    # Taking into account z.number().min(), .max(), .positive(), .nonnegative(), etc
    exclusiveMinimum: true | false
    exclusiveMaximum: true | false
ZodString: # z.string()
  before:
    type: string
  after:
    type: string
    minLength: value # optional, when z.string().min(value)
    maxLength: value # optional, when z.string().max(value)
    format: email | uuid | url # when z.string().email(), .uuid(), .url()
    pattern: /your regular expression/ # when z.string().regex(value)
```

- Since `z.number().int()` is a
  [JS Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) which is
  neither `int32` nor `int64` but rather `int53`, I made a decision to describe it as `int64` predefined `format` with
  an indispensable minimum and maximum values.

### v2.1.1

- Fixed issue [#92](https://github.com/RobinTail/express-zod-api/issues/92): The error
  `Cannot convert undefined or null to object` in OpenAPI generator when using `z.record()` type has been fixed.
- Supporting type `z.any()` in OpenAPI generator.

### v2.1.0

- Zod version is 3.7.1.
- New response schema type `ZodFile` can be created using `z.file()`. It has two refinements: `.binary()` and
  `.base64()` which also reflected in the generated Swagger / OpenAPI documentation.
  You can use it instead of `z.string()` with `createApiResponse()`:

```typescript
// before
const fileStreamingEndpointsFactoryBefore = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => createApiResponse(z.string(), "image/*"),
    // ...,
  }),
);

// after
const fileStreamingEndpointsFactoryAfter = new EndpointsFactory(
  createResultHandler({
    getPositiveResponse: () => createApiResponse(z.file().binary(), "image/*"),
    // ...,
  }),
);
```

- Please do NOT use `z.file()` within the `Endpoint` input / output object schemas.

### v2.0.0

- **Warning**: There are breaking changes described below.
  In general, if you used the `defaultResultHandler` before, then you won't have to change much of code.
- **Motivation**. I really like the first version of the library for its simplicity and elegance,
  but there is one imperfection in it. The available methods and type helpers do not allow to disclose the complete
  response of the endpoint, including the specification of a successful and error response for which the
  `ResultHandler` is responsible. So I decided to fix it, although it made the implementation somewhat more
  complicated, but I found it important. However, it brought a number of benefits, which are also described below.
- Node version required: at least `10.0.0` and the library target now is `ES6`.
- Type `ResultHandler` is no longer exported, please use `createResultHandler()` or `defaultResultHandler`.
- The optional property `resultHandler` of `ConfigType` has been replaced with `errorHandler`.
- The `setResultHandler()` method of `EndpointsFactory` class has been removed. The `ResultHandlerDefinition` has
  to be specified as an argument of `EndpointsFactory` constructor. You can use `defaultResultHandler` or
  `createResultHandler()` for this, or you can use `defaultEndpointsFactory`.
- Added the [Security policy](SECURITY.md).
- Some private methods have been made "entirely private" using the new typescript hashtag syntax.
- New methods of `Endpoint` class `getPositiveResponseSchema()` and `getNegativeResponseSchema()` return the
  complete response of the endpoint taking into account the `ResultHandlerDefinition` schemas.
  New methods: `getPositiveMimeTypes()` and `getNegativeMimeTypes()` return the array of mime types.
- New type helping utility: `EndpointResponse<E extends AbstractEndpoint>` to be used instead of `EndpointOutput`
  returns the complete type of the endpoint response including both positive and negative cases.
- Fixed `EndpointOutput<>` type helper for the non-object response type in the `ResultHandlerDefinition`.
- Zod version is 3.5.1.
- Better examples including a custom `ResultHandler` and a file download.
- Obtaining the OpenAPI / Swagger specification has been simplified: now you can call `getSpecAsYaml()` method
  directly on `OpenAPI` class instance. There is also a new option `errorResponseDescription`.
- Fixed a bug of incorrect `getPositiveMimeTypes()` and `getNegativeMimeTypes()` usage in Swagger docs generator.
- OpenAPI / Swagger specification no longer uses references for schemas and parameters, so they are inline now.
  Instead of `default` entry in `responses` there are HTTP status codes `200` and `400` that represent positive
  and negative responses accordingly. Response schemas are now complete as well.
- For creating your own `ResultHandlerDefinition` please use `createResultHandler()`. It also requires
  `createApiResponse()` to be used that takes a response schema and optional mime types as arguments.
  The endpoint output should be wrapped in `markOutput()`. So far this is the only way I have come up with to
  facilitate type inference with essentially double nesting of generic types. Typescript does not yet support such
  features as `MyGenericType<A<B>>`.

```typescript
// before
export const endpointsFactoryBefore = new EndpointsFactory();
// after
export const endpointsFactoryAfter = new EndpointsFactory(defaultResultHandler);
// which is the same as
import { defaultEndpointsFactory } from "express-zod-api";
```

```typescript
// before
resultHandler: ResultHandler; // optional
// after
errorHandler: ResultHandlerDefinition<any, any>; // optional, default: defaultResultHandler
```

```typescript
// Example. Before (v1):
import { EndpointOutput } from "express-zod-api";

const myEndpointV1 = endpointsFactory.build({
  method: "get",
  input: z.object({
    /* ... */
  }),
  output: z.object({
    name: z.string(),
  }),
  handler: async () => ({
    /* ... */
  }),
});
type MyEndpointOutput = EndpointOutput<typeof myEndpointV1>; // => { name: string }

// and after (v2):
import { defaultEndpointsFactory, EndpointResponse } from "express-zod-api";

const myEndpointV2 = defaultEndpointsFactory.build({
  method: "get",
  input: z.object({
    /* ... */
  }),
  output: z.object({
    name: z.string(),
  }),
  handler: async () => ({
    /* ... */
  }),
});
type MyEndpointResponse = EndpointResponse<typeof myEndpointV2>; // => the following type:
//  {
//    status: 'success';
//    data: { name: string };
//  } | {
//    status: 'error',
//    error: { message: string };
//  }
```

```typescript
// before
new OpenAPI({
  /* ... */
}).builder.getSpecAsYaml();
// after
new OpenAPI({
  /* ... */
}).getSpecAsYaml();
```

```typescript
// before
const myResultHandlerV1: ResultHandler = ({
  error,
  request,
  response,
  input,
  output,
  logger,
}) => {
  /* ... */
};
// after
const myResultHandlerV2 = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) =>
    createApiResponse(
      z.object({
        // ...,
        someProperty: markOutput(output),
      }),
      ["mime/type1", "mime/type2"], // optional, default: application/json
    ),
  getNegativeResponse: () =>
    createApiResponse(
      z.object({
        /* ... */
      }),
    ),
  handler: ({ error, input, output, request, response, logger }) => {
    /* ... */
  },
});
```

## Version 1

### v1.3.1

- Improving the coverage I found a bug and fixed it.
  In some cases there was an issue with CORS requests: [preflight OPTIONS requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests).
  Despite the enabled configuration option `cors: true` the OPTIONS requests have not been handled properly.
  This was leading to the 404 error with a message "Can not OPTIONS \<route\>".
  The issue has been fixed and covered by multiple tests.

### v1.3.0

- Zod version is 3.2.0.
- Minor changes to logging internal server errors.

### v1.2.1

- Additional handling of keys in `Routing` objects.
- `createServer`, `attachRouting` and `new OpenAPI()` may throw an Error in case of using slashes in `Routing` keys.

### v1.2.0

- Ability to specify the endpoint description and export it to the Swagger / OpenAPI specification:
  - The feature suggested by [@glitch452](https://github.com/glitch452).

```typescript
// example
const endpoint = endpointsFactory.build({
  description: "Here is an example description of the endpoint",
  // ...,
});
```

- Ability to specify either `methods` or `method` property to `.build()`. This is just a more convenient way for a single method case.

```typescript
// example
const endpoint = endpointsFactory.build({
  method: "get", // same as methods:['get'] before
  // ...,
});
```

- Ability for a route to have multiple Endpoints attached depending on different methods.
  It can also be the same Endpoint that handle multiple methods as well.
  This is a solution for the question raised in issue [#29](https://github.com/RobinTail/express-zod-api/issues/29).

```typescript
// example of different I/O schemas for /v1/user
const routing: Routing = {
  v1: {
    user: new DependsOnMethod({
      get: myEndpointForGetAndDelete,
      delete: myEndpointForGetAndDelete,
      post: myEndpointForPostAndPatch,
      patch: myEndpointForPostAndPatch,
    }),
  },
};
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
  input: z
    .object({
      one: z.string(),
    })
    .or(
      z.object({
        two: z.number(),
      }),
    ),
  middleware: async ({ input }) => ({
    input, // => type: { one: string } | { two: number }
  }),
});
```

- Ability to use `z.transform()` in handler's output schema.

```typescript
// example
const endpoint = factory.build({
  methods: ["post"],
  input: z.object({}),
  output: z.object({
    value: z.string().transform((str) => str.length),
  }),
  handler: async ({ input, options }) => ({
    value: "test", // => in response: { value: 4 }
  }),
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
  };
  logger: LoggerConfig | winston.Logger;
}

// after
export type ConfigType = (
  | {
      server: {
        // server configuration
        listen: number | string; // preserved
        jsonParser?: NextHandleFunction; // preserved
      };
    }
  | {
      // or your custom express app
      app: Express;
    }
) & {
  cors: boolean; // moved
  resultHandler?: ResultHandler; // moved
  logger: LoggerConfig | Logger;
};
```

- More convenient way to attach routing to your custom express app:

```typescript
// before
initRouting({ app, logger, config, routing });
// after
const config: ConfigType = { app /* ..., */ };
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

### v0.2.2

- First published release.
- Zod version is v3.0.0-alpha4.
