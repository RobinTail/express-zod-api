import _fetch from "node-fetch";

/**
 * @todo get rid of this when the following issue fixed:
 * @link https://github.com/DefinitelyTyped/DefinitelyTyped/issues/60924
 * @todo also remove @types/node-fetch dependency
 * @todo also remove symlinks in tests/esm and tests/integration
 */

declare global {
  declare var fetch: typeof _fetch;
}
