# Plan: Migrate Integration to Text-Based Generation

## Goal

Replace TypeScript compiler API factory calls in `integration-base.ts` and `integration.ts`
with plain text templates, while keeping `zts.ts` on the TS factory API.

## Why

`integration-base.ts` (707 lines) uses ~36 helpers from `typescript-api.ts` to construct
AST nodes that are immediately serialized to text. The runtime code it generates (Client
class, Subscription class, helper functions) is completely static and never varies based
on Zod schemas — it's the same TypeScript code every time, parameterized only by class
names and the server URL. Template strings are the natural representation for this.

### Readability gains by method

| Method                | Current LOC | Expected LOC |
| --------------------- | ----------- | ------------ |
| `makeSubstituteFn()`  | 60          | ~15          |
| `makeDefaultImplementation()` | 120+ | ~30      |
| `#makeHasMoreMethod()` | 40         | ~10          |
| `#makeProvider()`     | 30          | ~8           |
| `makeClientClass()`   | 16          | ~15          |
| `makeSubscriptionClass()` | 25      | ~20          |
| `#makeOnMethod()`     | 50          | ~12          |
| `makeUsageStatements()` | 18        | ~8           |

## Constraint: The `zts.ts` Bridge

`zts.ts` produces `ts.TypeNode` AST nodes. The `ZTSContext.makeAlias` callback must
return `ts.TypeNode`. The public `brandHandling` API accepts callbacks returning
`ts.TypeNode`. These interfaces **cannot change**. Instead, we bridge by deferring
`printNode()` calls: the constructor pushes lambdas like
`(printerOptions?) => printNode(typeNode, printerOptions)` into `#program`, and
`print()`/`printFormatted()` pass `printerOptions` through when resolving them at output
time. This avoids calling `printNode()` eagerly (the TS printer may become async in the
future) while preserving the existing public API signatures.

## Constraint: Preserve `ids` Naming and `propOf` Type Safety

The text templates must continue using the `ids` object for all generated variable names.
This maintains a single source of truth — if a name changes, it changes in one place.

The `propOf` helper must also be preserved in the templates. It provides compile-time
guarantees that property names belong to the expected types:

```typescript
// propOf ensures "method" is a valid key of RequestInit
propOf<RequestInit>("method") // compiles
propOf<RequestInit>("nope")   // error
```

In text templates, `propOf` is used as `${propOf<Type>("prop")}` — it resolves to the
string at the TypeScript level while retaining type safety in the generator code itself.
This matters because the generator must produce correct TypeScript; a typo in a property
name would be invisible until a consumer hits a runtime error.

## Test Safety

All integration tests assert against snapshot strings (`toMatchSnapshot()`). No test
inspects AST structure. Any implementation change that produces identical output text
will pass. Snapshots will need updating only if formatting differs.

---

## Phase 1: Migrate `integration-base.ts`

### 1.1 Change the `Store` type

```typescript
// Before
type Store = Record<IOKind, ts.TypeNode>;

// After
type Store = Record<IOKind, string>;
```

All downstream code that reads from `store` (the public interfaces builder, the
per-endpoint processing in `integration.ts`) must handle strings instead of AST nodes.

### 1.2 Reduce `typescript-api` imports

After conversion, `integration-base.ts` retains only `propOf` from `typescript-api.ts`.
Remove all other helpers. The final import block:

```typescript
import { propOf } from "./typescript-api";
```

Keep the existing non-typescript-api imports:
- `ResponseVariant` from `./api-response`
- `contentTypes` from `./content-type`
- `clientMethods`, `ClientMethod` from `./method`
- `makeEventSchema` type from `./sse`
- `CursorPaginatedResult`, `OffsetPaginatedResult` from `./paginated-schema`

### 1.3 Convert static type generators

Each becomes a function returning a string literal, using `ids.*` for all names:

**`makeSomeOfType()`**
```typescript
protected makeSomeOfType = () => `type ${ids.someOfType}<T> = T[keyof T];`;
```

**`makeMethodType()`** — iterate `clientMethods` to build the union:
```typescript
protected makeMethodType = () =>
  `export type ${ids.methodType} = ${clientMethods.map((m) => `"${m}"`).join(" | ")};`;
```

**`makeRequestType()`**
```typescript
protected makeRequestType = () => `export type ${ids.requestType} = keyof ${interfaces.input};`;
```

**`makePathType()`** — dynamic, uses `this.paths`:
```typescript
protected makePathType = () =>
  `export type ${ids.pathType} = ${Array.from(this.paths).map((p) => `"${p}"`).join(" | ")};`;
```

**`makeImplementationType()`** — 15 lines of AST → 5-line template:
```typescript
protected makeImplementationType = () =>
  `export type ${ids.implementationType}<${ids.ctxArgument} = unknown> = (\n` +
  `  ${ids.methodParameter}: ${ids.methodType},\n  ${ids.pathParameter}: string,\n` +
  `  ${ids.paramsArgument}: Record<string, any>,\n  ${ids.ctxArgument}?: ${ids.ctxArgument},\n` +
  `) => Promise<any>;`;
```

**`makePaginationType()`** — 20 lines of AST → 8-line template:
```typescript
protected makePaginationType = () =>
  `type ${ids.paginationType} =\n` +
  `  | { ${propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor")}: string | null }\n` +
  `  | { ${propOf<OffsetPaginatedResult["output"]["shape"]>("total")}: number;\n` +
  `      ${propOf<OffsetPaginatedResult["output"]["shape"]>("limit")}: number;\n` +
  `      ${propOf<OffsetPaginatedResult["output"]["shape"]>("offset")}: number };`;
```

### 1.4 Convert dynamic builders

**`makePublicInterfaces()`** — iterate the registry, produce text:
```typescript
protected makePublicInterfaces = () =>
  (Object.keys(interfaces) as IOKind[]).map((kind) => {
    const props = Array.from(this.registry)
      .map(([request, { store, isDeprecated }]) => {
        const deprecated = isDeprecated ? "  /** @deprecated */\n" : "";
        return `${deprecated}  "${request}": ${store[kind]};`;
      })
      .join("\n");
    return `export interface ${interfaces[kind]} {\n${props}\n}`;
  });
```

**`someOf()`** — changes signature from accepting `ts.TypeAliasDeclaration` to string:
```typescript
// Before
protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
  ensureTypeNode(ids.someOfType, [name]);

// After
protected someOf = (name: string) => `${ids.someOfType}<${name}>`;
```

**`makeEndpointTags()`** — 12 lines of AST → ~8 lines template:
```typescript
protected makeEndpointTags = () => {
  const entries = Array.from(this.tags)
    .map(([request, tags]) => {
      const values = tags.map((t) => `"${t}"`).join(", ");
      return `  "${request}": [${values}]`;
    })
    .join(",\n");
  return `export const endpointTags = {\n${entries}\n};`;
};
```

### 1.5 Convert runtime code generators

These are the biggest wins. Every one of these methods currently builds 30-120 lines of
AST to produce 8-30 lines of static TypeScript code. All use `ids.*` for names and
`propOf` for type-safe property references.

**`makeParseRequestFn()`** — 15 lines AST → 2 lines text:
```typescript
protected makeParseRequestFn = () =>
  `const ${ids.parseRequestFn} = (${ids.requestParameter}: string) =>\n` +
  `  ${ids.requestParameter}.split(/ (.+)/, 2) as [${ids.methodType}, ${ids.pathType}];`;
```

**`makeSubstituteFn()`** — 60 lines AST → ~15 lines text:
```typescript
protected makeSubstituteFn = () =>
  `const ${ids.substituteFn} = (${ids.pathParameter}: string, ${ids.paramsArgument}: Record<string, any>) => {\n` +
  `  const ${ids.restConst} = { ...${ids.paramsArgument} };\n` +
  `  for (const ${ids.keyParameter} in ${ids.paramsArgument}) {\n` +
  `    ${ids.pathParameter} = ${ids.pathParameter}.${propOf<string>("replace")}(\`:\${${ids.keyParameter}}\`, () => {\n` +
  `      delete ${ids.restConst}[${ids.keyParameter}];\n` +
  `      return ${ids.paramsArgument}[${ids.keyParameter}];\n` +
  `    });\n` +
  `  }\n` +
  `  return [${ids.pathParameter}, ${ids.restConst}] as const;\n` +
  `};`;
```

**`#makeHasMoreMethod()`** — 40 lines AST → ~10 lines text:
```typescript
#makeHasMoreMethod = () => {
  const nextCursorProp = propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor");
  const totalProp = propOf<OffsetPaginatedResult["output"]["shape"]>("total");
  const limitProp = propOf<OffsetPaginatedResult["output"]["shape"]>("limit");
  const offsetProp = propOf<OffsetPaginatedResult["output"]["shape"]>("offset");
  return (
    `  public static hasMore(${ids.responseConst}: ${ids.paginationType}): boolean {\n` +
    `    if ("${nextCursorProp}" in ${ids.responseConst})\n` +
    `      return ${ids.responseConst}.${nextCursorProp} !== null;\n` +
    `    return ${ids.responseConst}.${offsetProp} + ${ids.responseConst}.${limitProp} < ${ids.responseConst}.${totalProp};\n` +
    `  }`
  );
};
```

**`#makeProvider()`** — 30 lines AST → ~8 lines text:
```typescript
#makeProvider = () =>
  `  public ${ids.provideMethod}<K extends ${ids.requestType}>(\n` +
  `    ${ids.requestParameter}: K,\n` +
  `    ${ids.paramsArgument}: ${interfaces.input}[K],\n` +
  `    ${ids.ctxArgument}?: T,\n` +
  `  ): Promise<${interfaces.response}[K]> {\n` +
  `    const [${ids.methodParameter}, ${ids.pathParameter}] = ${ids.parseRequestFn}(${ids.requestParameter});\n` +
  `    return this.${ids.implementationArgument}(${ids.methodParameter}, ...${ids.substituteFn}(${ids.pathParameter}, ${ids.paramsArgument}), ${ids.ctxArgument});\n` +
  `  }`;
```

**`makeDefaultImplementation()`** — 120+ lines AST → ~30 lines text:
```typescript
protected makeDefaultImplementation = () =>
  `const ${ids.defaultImplementationConst}: ${ids.implementationType} = async (${ids.methodParameter}, ${ids.pathParameter}, ${ids.paramsArgument}) => {\n` +
  `  const ${ids.hasBodyConst} = !["get", "head", "delete"].includes(${ids.methodParameter});\n` +
  `  const ${ids.searchParamsConst} = ${ids.hasBodyConst} ? "" : \`?\${new URLSearchParams(${ids.paramsArgument})}\`;\n` +
  `  const ${ids.responseConst} = await fetch(\n` +
  `    new URL(\`\${${ids.pathParameter}}\${${ids.searchParamsConst}}\`, "${this.serverUrl}"),\n` +
  `    {\n` +
  `      ${propOf<RequestInit>("method")}: ${ids.methodParameter}.${propOf<string>("toUpperCase")}(),\n` +
  `      ${propOf<RequestInit>("headers")}: ${ids.hasBodyConst} ? { "Content-Type": "${contentTypes.json}" } : undefined,\n` +
  `      ${propOf<RequestInit>("body")}: ${ids.hasBodyConst} ? JSON.stringify(${ids.paramsArgument}) : undefined,\n` +
  `    },\n` +
  `  );\n` +
  `  const ${ids.contentTypeConst} = ${ids.responseConst}.${propOf<Response>("headers")}.${propOf<Headers>("get")}("content-type");\n` +
  `  if (!${ids.contentTypeConst}) return;\n` +
  `  const ${ids.isJsonConst} = ${ids.contentTypeConst}.${propOf<string>("startsWith")}("${contentTypes.json}");\n` +
  `  return ${ids.responseConst}[${ids.isJsonConst} ? "${propOf<Response>("json")}" : "${propOf<Response>("text")}"]();\n` +
  `};`;
```

**`#makeSubscriptionConstructor()`** — text:
```typescript
#makeSubscriptionConstructor = () =>
  `  constructor(\n` +
  `    ${ids.requestParameter}: K,\n` +
  `    ${ids.paramsArgument}: ${interfaces.input}[K],\n` +
  `  ) {\n` +
  `    const [${ids.pathParameter}, ${ids.restConst}] = ${ids.parseRequestFn}(\n` +
  `      ${ids.requestParameter}.split(/ (.+)/, 2)[1],\n` +
  `    );\n` +
  `    const ${ids.searchParamsConst} = \`?\${new URLSearchParams(${ids.restConst})}\`;\n` +
  `    this.${ids.sourceProp} = new EventSource(new URL(\`\${${ids.pathParameter}}\${${ids.searchParamsConst}}\`, "${this.serverUrl}"));\n` +
  `  }`;
```

**`#makeOnMethod()`** — text:
```typescript
#makeOnMethod = () =>
  `  public ${ids.onMethod}<E extends keyof Extract<R, { ${propOf<SSEShape>("event")}: string }>>(\n` +
  `    ${ids.eventParameter}: E,\n` +
  `    ${ids.handlerParameter}: (data: Extract<R, { ${propOf<SSEShape>("event")}: E }>[${propOf<SSEShape>("data")}]) => void,\n` +
  `  ) {\n` +
  `    this.${ids.sourceProp}.${propOf<EventSource>("addEventListener")}(${ids.eventParameter}, (${ids.msgParameter}) => {\n` +
  `      ${ids.handlerParameter}(JSON.${propOf<JSON>("parse")}(\n` +
  `        (${ids.msgParameter} as MessageEvent).${propOf<SSEShape>("data")}\n` +
  `      ));\n` +
  `    });\n` +
  `    return this;\n` +
  `  }`;
```

**`makeClientClass()`** — compose from text pieces:
```typescript
protected makeClientClass = (name: string) =>
  `export class ${name}<${ids.ctxArgument}> {\n` +
  `  public constructor(\n` +
  `    protected readonly ${ids.implementationArgument}: ${ids.implementationType}<${ids.ctxArgument}> = ${ids.defaultImplementationConst},\n` +
  `  ) {}\n` +
  `\n${this.#makeProvider()}\n` +
  `\n${this.#makeHasMoreMethod()}\n` +
  `}`;
```

**`makeSubscriptionClass()`** — compose from text pieces:
```typescript
protected makeSubscriptionClass = (name: string) =>
  `export class ${name}<\n` +
  `  K extends Extract<${ids.requestType}, \`get \${string}\`>,\n` +
  `  R extends Extract<${interfaces.positive}[K], { ${propOf<SSEShape>("event")}: string }>,\n` +
  `> {\n` +
  `  public ${ids.sourceProp}: EventSource;\n` +
  `\n${this.#makeSubscriptionConstructor()}\n` +
  `\n${this.#makeOnMethod()}\n` +
  `}`;
```

**`makeUsageStatements()`** — return strings directly:
```typescript
protected makeUsageStatements = (
  clientClassName: string,
  subscriptionClassName: string,
): string[] => [
  `const ${ids.clientConst} = new ${clientClassName}();`,
  `${ids.clientConst}.${ids.provideMethod}("get /v1/user/retrieve", { id: "10" });`,
  `new ${subscriptionClassName}("get /v1/events/stream", {}).${ids.onMethod}("time", (time) => {});`,
];
```

### 1.6 Remove now-unused helpers from `integration-base.ts`

After conversion, these imports from `typescript-api.ts` are eliminated entirely:
`Typeable`, `accessModifiers`, `ensureTypeNode`, `literally`, `makeAssignment`,
`makeCall`, `makeConst`, `makeDeconstruction`, `makeExtract`, `makeFnType`, `makeId`,
`makeIndexed`, `makeInterface`, `makeInterfaceProp`, `makeKeyOf`, `makeLiteralType`,
`makeMaybeAsync`, `makeNew`, `makeOneLine`, `makeParam`, `makeParams`, `makePromise`,
`makePropertyIdentifier`, `makePublicClass`, `makePublicConstructor`,
`makePublicLiteralType`, `makePublicMethod`, `makePublicProperty`, `makeRecordStringAny`,
`makeTemplate`, `makeTernary`, `makeType`, `makeUnion`, `ts`, `makeArrowFn`, `f`.

**Retained** from `typescript-api.ts`: `propOf` — used throughout templates for
type-safe property names on `RequestInit`, `Response`, `Headers`, `EventSource`,
`SSEShape`, `CursorPaginatedResult`, `OffsetPaginatedResult`.

---

## Phase 2: Migrate `integration.ts`

### 2.1 Change internal data structures

```typescript
// Before
readonly #program: ts.Node[] = [this.makeSomeOfType()];
readonly #aliases = new Map<object, ts.TypeAliasDeclaration>();
#usage: Array<ts.Node | string> = [];

// After
readonly #program: Array<string | ((printerOptions?: ts.PrinterOptions) => string)> = [];
readonly #aliasNames = new Map<object, string>();
#usage: string[] = [];
```

`#program` is now initialized empty. `makeSomeOfType()` is pushed after `walkRouting()`
so that aliases (discovered during routing) appear first — matching the current
`unshift` ordering. The array holds either ready-made text strings (from
`integration-base.ts` template methods) or functions that accept optional
`printerOptions` and call `printNode()` to produce text from `ts.TypeNode` AST nodes
(the `zodToTs()` boundary). `print()` passes `printerOptions` through when resolving
these functions, keeping the constructor synchronous and free of `printNode` calls.

### 2.2 The `#makeAlias` bridge

This is the critical piece. It must still return `ts.TypeNode` for `zts.ts` compatibility,
but defers `printNode()` into a lambda pushed to `#program`:

```typescript
#makeAlias(key: object, produce: () => ts.TypeNode): ts.TypeNode {
  let name = this.#aliasNames.get(key);
  if (!name) {
    name = `Type${this.#aliasNames.size + 1}`;
    this.#aliasNames.set(key, name); // register before produce() to break cycles
    const typeNode = produce(); // zts calls back recursively
    // Defer printNode until output time — printer may become async in the future
    this.#program.push((opts) => `type ${name} = ${printNode(typeNode, opts)};`);
  }
  return ensureTypeNode(name); // still returns ts.TypeNode for zts compatibility
}
```

Note: alias functions are pushed to `#program` during construction via `walkRouting()`.
Since `#program` starts empty, aliases naturally accumulate first. `makeSomeOfType()`
and all other entries are pushed after `walkRouting()` in §2.4, preserving the correct
ordering without needing `unshift`.

### 2.3 Convert the constructor's per-endpoint processing

The endpoint handler currently pushes AST nodes to `#program`. After migration, it pushes
deferred `printNode` lambdas for schema-derived types, and plain strings for interface
dicts:

```typescript
const onEndpoint: OnEndpoint<ClientMethod> = (method, path, endpoint) => {
  const entitle = makeCleanId.bind(null, method, path);
  const { isDeprecated, inputSchema, tags } = endpoint;
  const request = `${method} ${path}`;

  // Input type — defer printNode until output time
  const inputTypeName = entitle("input");
  this.#program.push((opts) => {
    const text = printNode(zodToTs(inputSchema, ctxIn), opts);
    return `/** ${request} */\ntype ${inputTypeName} = ${text};`;
  });

  // Response variants
  const dictionaries = responseVariants.reduce(
    (agg, responseVariant) => {
      const responses = endpoint.getResponses(responseVariant);
      const propLines: string[] = [];
      const variantNames: string[] = [];

      for (const [idx, { schema, mimeTypes, statusCodes }] of responses) {
        const hasBody = shouldHaveContent(method, mimeTypes);
        const variantName = entitle(responseVariant, "variant", `${idx + 1}`);
        this.#program.push((opts) => {
          const text = printNode(
            zodToTs(hasBody ? schema : noBodySchema, ctxOut),
            opts,
          );
          return `/** ${request} */\ntype ${variantName} = ${text};`;
        });
        for (const code of statusCodes) {
          propLines.push(`  ${code}: ${variantName};`);
        }
        variantNames.push(variantName);
      }

      const dictName = entitle(responseVariant, "response", "variants");
      this.#program.push(
        `/** ${request} */\ninterface ${dictName} {\n${propLines.join("\n")}\n}`,
      );

      return Object.assign(agg, { [responseVariant]: dictName });
    },
    {} as Record<ResponseVariant, string>,
  );

  this.paths.add(path);
  const literalIdx = `"${request}"`;

  const store = {
    input: inputTypeName,
    positive: this.someOf(dictionaries.positive),
    negative: this.someOf(dictionaries.negative),
    response: `${interfaces.positive}${literalIdx} | ${interfaces.negative}${literalIdx}`,
    encoded: `${dictionaries.positive} & ${dictionaries.negative}`,
  };

  this.registry.set(request, { isDeprecated, store });
  this.tags.set(request, tags);
};
```

### 2.4 Assemble the program

```typescript
walkRouting({ routing, config, onEndpoint: hasHeadMethod ? withHead(onEndpoint) : onEndpoint });

// Aliases were pushed to #program during walkRouting — they're first.
// Now append makeSomeOfType, then public types, then runtime code:
this.#program.push(
  this.makeSomeOfType(),
  this.makePathType(),
  this.makeMethodType(),
  ...this.makePublicInterfaces(),
  this.makeRequestType(),
);

if (variant === "types") return;

// Append the client runtime code
this.#program.push(
  this.makeEndpointTags(),
  this.makeParseRequestFn(),
  this.makeSubstituteFn(),
  this.makeImplementationType(),
  this.makePaginationType(),
  this.makeDefaultImplementation(),
  this.makeClientClass(clientClassName),
  this.makeSubscriptionClass(subscriptionClassName),
);

this.#usage.push(
  ...this.makeUsageStatements(clientClassName, subscriptionClassName),
);
```

### 2.5 Simplify `print()` and `printFormatted()`

`#program` entries are resolved lazily at output time — strings pass through, functions
receive `printerOptions` from the caller.

```typescript
#resolveProgram(printerOptions?: ts.PrinterOptions) {
  return this.#program.map((entry) =>
    typeof entry === "string" ? entry : entry(printerOptions),
  );
}

#printUsage() {
  return this.#usage.length ? this.#usage.join("\n") : undefined;
}

public print(printerOptions?: ts.PrinterOptions) {
  const parts = this.#resolveProgram(printerOptions);
  const usageText = this.#printUsage();
  if (usageText) {
    parts.push(`\n// Usage example:\n/*\n${usageText}\n*/`);
  }
  return parts.join("\n\n");
}

public async printFormatted({
  printerOptions,
  format: userDefined,
}: FormattedPrintingOptions = {}) {
  let format = userDefined;
  if (!format) {
    try {
      const prettierFormat = loadPeer<typeof Prettier>("prettier").format;
      format = (text) => prettierFormat(text, { filepath: "client.ts" });
    } catch {}
  }
  const usageExample = this.#printUsage();
  if (usageExample && format) {
    this.#usage = [await format(usageExample)];
  }
  const output = this.print(printerOptions);
  return format ? format(output) : output;
}
```

### 2.6 Keep `FormattedPrintingOptions` and `print(printerOptions?)`

The public API is unchanged. `FormattedPrintingOptions` stays, `print()` keeps its
`printerOptions` parameter. The only internal change is that `print()` passes
`printerOptions` through to deferred `printNode()` lambdas instead of the lambdas
closing over a stored field.

No changes needed — the existing signatures work as-is with the new resolution logic
in §2.5.

---

## Phase 3: Update Tests

### 3.1 Snapshot updates

Run tests and update snapshots. The `printFormatted()` tests (5 of 6 test cases) use
Prettier formatting, so their output should be identical regardless of internal
representation.

The `print()` tests (recursive schema test) use the raw TS printer's 4-space
indentation. With text templates using 2-space indentation, these snapshots will change.
This is acceptable — the indentation style is not part of the API contract.

### 3.2 Type-level test

The `expectTypeOf` test in `integration.spec.ts` (line 167) checks that a callback
returning `ts.TypeNode` satisfies the `Producer` type. This test is unaffected since
`Producer` type and `brandHandling` interface are unchanged.

### 3.3 Brand handling test

The `brandHandling` test (line 142) passes a callback returning
`ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)`. This still works
because the bridge in `integration.ts` calls `printNode()` on the returned `ts.TypeNode`.

---

## Phase 4: Update Changelog

### 4.1 CHANGELOG entry

Add to `CHANGELOG.md`:

```markdown
### vNEXT

- Refactored code generation in `Integration` to use text templates instead of
  TypeScript compiler API, improving readability and maintainability;
- Deferred `printNode()` calls in `Integration` to output time, preparing for
  potential async TS printer support.
```

No breaking changes — `FormattedPrintingOptions`, `print(printerOptions?)`, and
`printFormatted(options?)` signatures are preserved.

---

## Phase 5: Clean up `typescript-api.ts`

After Phases 1-2, many helpers are only used by `zts.ts` and tests. The helpers that
can be removed (used only by integration code):

`makeAssignment`, `makeCall`, `makeDeconstruction`, `makeExtract`, `makeFnType`,
`makeId`, `makeKeyOf`, `makeMaybeAsync`, `makeNew`, `makeOneLine`, `makePromise`,
`makePropertyIdentifier`, `makePublicClass`, `makePublicConstructor`,
`makePublicLiteralType`, `makePublicMethod`, `makePublicProperty`, `makeRecordStringAny`,
`makeTemplate`, `makeTernary`, `makeType`, `makeArrowFn`, `makeConst`, `makeParam`,
`makeParams`, `literally`, `accessModifiers`, `Typeable` (type).

**Must keep** (used by `integration-base.ts` templates, `zts.ts`, and/or tests):
`ts`, `f`, `ensureTypeNode`, `makeInterfaceProp`, `makeLiteralType`, `makeUnion`,
`makeIndexed`, `makeInterface`, `printNode`, `propOf`.

`propOf` is used by `integration-base.ts` for type-safe property names in all text
templates (e.g., `propOf<RequestInit>("method")`, `propOf<Response>("headers")`).
It must remain exported from `typescript-api.ts`.

Note: `makeIndexed` and `makeInterface` are used by `zts.ts` indirectly (through
`makeInterfaceProp`). Verify before removing. `makeInterface` is used by `zts.ts`
in the `onObject` producer via `makeInterfaceProp` (which creates property signatures
for `f.createTypeLiteralNode`). Actually `makeInterface` itself is not used by `zts.ts`
— only by `integration-base.ts`. So it can be removed.

`makeIndexed` IS used by `zts.ts` indirectly? No — checking the imports, `zts.ts`
only imports: `ensureTypeNode`, `f`, `makeInterfaceProp`, `makeLiteralType`,
`makeUnion`, `ts`. So `makeIndexed` can also be removed.

---

## Execution Order

1. Phase 1 (`integration-base.ts`) — can be verified independently by checking that
   the class compiles and its methods return the expected text strings
2. Phase 2 (`integration.ts`) — depends on Phase 1; run integration tests after
3. Phase 3 (tests/snapshots) — update snapshots after Phase 2
4. Phase 4 (changelog) — after tests pass
5. Phase 5 (cleanup) — last, after everything else is stable

## Risks

- **Formatting drift**: The text templates must produce output that Prettier normalizes
  correctly. Edge case: template literal backticks in generated code (the `substitute`
  function uses `` `:${key}` ``) — must be escaped properly in the outer template string.
- **Indentation in `print()` snapshots**: Raw `print()` output uses 4-space indentation
  from the TS printer. Text templates will use 2-space. Snapshots will need updating.
- **The `@deprecated` JSDoc on interface properties**: Currently generated by
  `makeInterfaceProp`. After migration, must be reproduced manually in the text template.
