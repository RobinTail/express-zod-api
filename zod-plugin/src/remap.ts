import { z } from "zod";
import * as R from "ramda";

type TuplesFromObject<T> = {
  [P in keyof T]: [P, T[P]];
}[keyof T];

type GetKeyByValue<T, V> =
  TuplesFromObject<T> extends infer TT
    ? TT extends [infer P, V]
      ? P
      : never
    : never;

/**
 * @fileoverview Mapping utils for Zod Runtime Plugin (remap)
 * @link https://stackoverflow.com/questions/55454125/typescript-remapping-object-properties-in-typesafe
 * @todo try to reuse R.Remap from Ramda (requires to move its types to prod dependencies)
 */
export type Remap<T, U extends { [P in keyof T]?: V }, V extends string> = {
  [P in NonNullable<U[keyof U]>]: T[GetKeyByValue<U, P>];
};

export type Intact<T, U> = { [K in Exclude<keyof T, keyof U>]: T[K] };

type Mapper = <T extends Record<string, unknown>>(
  subject: T,
) => { [P in string | keyof T]: T[keyof T] };

/** Used by runtime (bound) */
export const remap = function (
  this: z.ZodObject,
  tool: Record<string, string> | Mapper,
) {
  const transformer =
    typeof tool === "function" ? tool : R.renameKeys(R.reject(R.isNil, tool)); // rejecting undefined
  const nextShape = transformer(
    R.map(R.invoker(0, "clone"), this._zod.def.shape), // immutable, changed from R.clone due to failure
  );
  const hasPassThrough = this._zod.def.catchall instanceof z.ZodUnknown;
  const output = (hasPassThrough ? z.looseObject : z.object)(nextShape); // proxies unknown keys when set to "passthrough"
  return this.transform(transformer).pipe(output);
};
