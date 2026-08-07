# Migration script for Express Zod API

ESLint plugin for migrating Express Zod API to its next major version.

## Requirements

- Either:
  - `eslint@^10.0.0` and `typescript-eslint@^8.58.0`;
  - or `oxlint@^1.76.0`.

## Usage

### with ESLint and TypeScript-ESLint

The minimal configuration to apply migrations automatically using `eslint --fix`:

```js
// eslint.config.mjs
import { parser } from "typescript-eslint";
import migration from "@express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v29": "error" } },
];
```

### with OxLint

The minimal configuration to apply migrations automatically using `oxlint --fix`:

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript"],
  jsPlugins: [{ name: "migration", specifier: "@express-zod-api/migration" }],
  rules: { "migration/v29": "error" },
});
```
