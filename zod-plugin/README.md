# Zod Plugin for Express Zod API

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
  - shorthand for `.meta({ "x-brand": ... })` making the brand available in runtime;

## Requirements

- Compatible with Zod versions `~4.3.4` (<4.4.0);
- Zod 4.4+ support will be available in v5 (the next major version).

## Basic usage

```ts
import { z } from "zod";
import "@express-zod-api/zod-plugin";

const schema = z.string().example("test").example("another").brand("custom");

schema.meta(); // { examples: ["test", "another"], "x-brand": "custom" }
```
