/**
 * @fileoverview Service types for Zod Runtime Plugin, mapping utils in particular.
 * @link https://stackoverflow.com/questions/55454125/typescript-remapping-object-properties-in-typesafe
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

export type Remap<T, U extends { [P in keyof T]: V }, V extends string> = {
  [P in U[keyof U]]: T[GetKeyByValue<U, P>];
};

export const asTuple = <A, B>(a: A, b: B): [A, B] => [a, b];
