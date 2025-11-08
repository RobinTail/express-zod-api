# Changelog

## Version 2

### v2.1.0

- `ZodObject::remap()` now throws an `Error` if duplicate target keys found in its argument.

### v2.0.0

- Restricting the supported Node.js versions: `^20.19.0 || ^22.12.0 || ^24.0.0`.

## Version 1

### v1.2.0

- Changed bundler from `tsup` to `tsdown`.

### v1.1.0

- Added low-level helpers `pack()` and `unpack()` to handle inheritable attributes that withstands refinements:
  - `schema.brand()` is a shorthand for `pack(schema, { brand })`;
  - `getBrand()` is a shorthand for `unpack(schema).brand`.

### v1.0.0

- First release: almost exact copy of Zod plugin from `express-zod-api`.
