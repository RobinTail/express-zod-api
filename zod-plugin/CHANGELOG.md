# Changelog

## Version 4

### v4.0.0

- Supported `zod` versions: `^4.3.4`;
- Zod made metadata inheritable, so that `pack()` and `unpack()` are removed;
  - Use the `.meta()` method of a schema instead of both helpers;
- Runtime distinguishable brand is now stored along with other metadata.

## Version 3

### v3.0.0

- Supported `zod` versions: `^4.1.13`;
- The plugin now also patches the CJS exports of `zod`.

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
