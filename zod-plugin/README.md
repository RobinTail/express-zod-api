# Zod Plugin from Express Zod API

## Overview

This module extends Zod functionality when it's imported:

- Adds `.example()` method to all Zod schemas:
  - shorthand for `.meta({ examples: [...] })`;
- Adds `.deprecated()` method to all Zod schemas:
  - shorthand for `.meta({ deprecated: true })`;
- Adds `.label()` method to `ZodDefault`:
  - shorthand for `.meta({ default: ... })`;
- Adds `.remap()` method to `ZodObject` for renaming object properties:
  - Supports a mapping object or an object transforming function as an argument;
  - Relies on `R.renameKeys()` from the `ramda` library;
- Alters the `.brand()` method on all Zod schemas:
  - shorthand for `.meta({ "x-brand": ... })` making the brand available in runtime via `getBrand()` helper;

## Requirements

- Zod `^4.3.4`

## Basic usage

```ts
import { z } from "zod";
import { getBrand } from "@express-zod-api/zod-plugin";

const schema = z.string().example("test").example("another").brand("custom");

getBrand(schema); // "custom"
schema.meta(); // { examples: ["test", "another"], "x-brand": "custom" }
```

## Helpers

- `getBrand()` — retrieves the brand from the schema that was set by its `.brand()` method.
