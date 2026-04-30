# Changelog

## Version 5

### v5.0.0

- Supported Node.js versions: `^22.19.0 || ^24.0.0`;
- `getBrand()` removed:
  - use `schema.meta()?.["x-brand"]` instead.

## Version 4

### v4.1.1

- Limited compatibility to Zod versions `~4.3.4` (<4.4.0):
  - Zod 4.4.0 introduced a breaking change to how `brand` method works, making the current plugin approach incompatible;
  - Support for Zod 4.4+ will be added in v5 (the next major version).

### v4.1.0

- Added `x-brand` type to the augmentation of Zod's `GlobalMeta` interface:
  - The property is used to store the brand of the schema when using the `ZodType::brand()` method.

### v4.0.1

- Removed debug-level comments from the declaration files in the distribution.

### v4.0.0

- Supported `zod` versions: `^4.3.4`;
- Zod made metadata inheritable, so that `pack()` and `unpack()` are removed;
  - Use the `.meta()` method of a schema instead of both helpers;
- Runtime-distinguishable brand is now stored along with other metadata.

## Version 3

### v3.0.1

- Improved readability of the types declaration in the bundle;

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
