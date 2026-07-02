import type { IRouter } from "express";

export type SomeMethod = Lowercase<string>;

type FamiliarMethod =
  | Exclude<keyof IRouter, "param" | "use" | "route" | "stack" | "all">
  /** @todo remove when merged: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/75187 */
  | "query";

export const methods = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "query",
] satisfies Array<FamiliarMethod>;

export const clientMethods = [
  ...methods,
  "head",
] satisfies Array<FamiliarMethod>;

/**
 * @desc Methods supported by the framework API to produce Endpoints on EndpointsFactory.
 * @see BuildProps
 * @example "get" | "post" | "put" | "delete" | "patch" | "query"
 * */
export type Method = (typeof methods)[number];

/**
 * @desc Methods usable on the client side, available via generated Integration and Documentation
 * @see withHead
 * @example Method | "head"
 * */
export type ClientMethod = (typeof clientMethods)[number];

/**
 * @desc Methods supported in CORS headers
 * @see createWrongMethodHandler
 * @example ClientMethod | "options"
 * */
export type CORSMethod = ClientMethod | Extract<FamiliarMethod, "options">;

export const isMethod = (subject: string): subject is Method =>
  (methods as string[]).includes(subject);
