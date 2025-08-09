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
- Alters the `.brand()` method on all Zod schemas by making the assigned brand available in runtime:
  - The brand set this way will withstand refinements, unlike the metadata set by `.meta()`.

## Requirements

- Zod `^4.0.0`

## Basic usage

```ts
import { z } from "zod";
import { getBrand } from "@express-zod-api/zod-plugin";

const schema = z.string().example("test").example("another").brand("custom");

getBrand(schema); // "custom"
schema.meta(); // { examples: ["test", "another"] }
```

## Helpers

- `getBrand()` — retrieves the brand from the schema that was set by its `.brand()` method;
- `pack()` — returns a cloned schema having inheritable attributes assigned (such as brand);
- `unpack()` — retrieves the attributes from the schema that was set by `pack()` helper.
