/**
 * @fileoverview Mapping utils for Zod Runtime Plugin (remap)
 * @link https://stackoverflow.com/questions/55454125/typescript-remapping-object-properties-in-typesafe
 * @todo try to reuse R.Remap from Ramda (requires to move its types to prod dependencies)
 */
type TuplesFromObject<T> = {
  [P in keyof T]: [P, T[P]];
}[keyof T];

type GetKeyByValue<T, V> =
  TuplesFromObject<T> extends infer TT
    ? TT extends [infer P, V]
      ? P
      : never
    : never;

export type Remap<T, U extends { [P in keyof T]?: V }, V extends string> = {
  [P in NonNullable<U[keyof U]>]: T[GetKeyByValue<U, P>];
};

export type Intact<T, U> = { [K in Exclude<keyof T, keyof U>]: T[K] };
