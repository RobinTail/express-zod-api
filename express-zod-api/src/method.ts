import type { IRouter } from "express";
import type { SetValue } from "./sets";

export type SomeMethod = Lowercase<string>;

type FamiliarMethod = Exclude<
  keyof IRouter,
  "param" | "use" | "route" | "stack" | "all"
>;

export const methods = new Set([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "query",
] satisfies Array<FamiliarMethod>);

export const clientMethods = methods.union(
  new Set(["head"] satisfies Array<FamiliarMethod>),
);

/**
 * @desc Methods supported by the framework API to produce Endpoints on EndpointsFactory.
 * @see BuildProps
 * @example "get" | "post" | "put" | "delete" | "patch" | "query"
 * */
export type Method = SetValue<typeof methods>;

/**
 * @desc Methods usable on the client side, available via generated Integration and Documentation
 * @see withHead
 * @example Method | "head"
 * */
export type ClientMethod = SetValue<typeof clientMethods>;

/**
 * @desc Methods supported in CORS headers
 * @see createWrongMethodHandler
 * @example ClientMethod | "options"
 * */
export type CORSMethod = ClientMethod | Extract<FamiliarMethod, "options">;

export const isMethod = (subject: string): subject is Method =>
  (methods as Set<string>).has(subject);
