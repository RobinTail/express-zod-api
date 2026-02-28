# Migration script for Express Zod API

ESLint plugin for migrating Express Zod API to its next major version.

## Requirements

- `eslint@^10.0.0`;
- `typescript-eslint@^8.56.0`

## Usage

The minimal configuration to apply migrations automatically using `eslint --fix`:

```js
// eslint.config.mjs
import { parser } from "typescript-eslint";
import migration from "@express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v28": "error" } },
];
```
