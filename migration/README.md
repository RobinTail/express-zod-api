# Migration script for Express Zod API

ESLint plugin for migrating Express Zod API to its next major version.

## Requirements

- `eslint` v9;
- `typescript-eslint` v8.

## Usage

The minimal configuration to apply migrations automatically using `eslint --fix`:

```js
// eslint.config.mjs
import parser from "@typescript-eslint/parser";
import migration from "@express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v24": "error" } },
];
```
