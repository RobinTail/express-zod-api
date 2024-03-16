/**
 * @todo remove when the types updated:
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/69016
 */
export module "express-fileupload" {
  export interface Options {
    /**
     * Customizable logger to write debug messages to.
     * @default console
     */
    logger?: { log: (msg: string) => void } | undefined;
  }
}
