# Changelog

## Version 1

### v1.1.0

- Added low-level helpers `pack()` and `unpack()` to handle inheritable attributes that withstands refinements:
  - `schema.brand()` is a shorthand for `pack(schema, { brand })`;
  - `getBrand()` is a shorthand for `unpack(schema).brand`.

### v1.0.0

- First release: almost exact copy of Zod plugin from `express-zod-api`.
