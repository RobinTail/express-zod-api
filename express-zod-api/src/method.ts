import type { IRouter } from "express";

export const methods = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
] satisfies Array<keyof IRouter>;

/**
 * @desc Methods supported by the framework API to produce Endpoints on EndpointsFactory.
 * @see BuildProps
 * */
export type Method = (typeof methods)[number];

/**
 * @desc Additional methods having some technical handling in the framework
 * @see makeCorsHeaders
 * */
export type AuxMethod = Extract<keyof IRouter, "options" | "head">;

export const clientMethods = [...methods, "head"] satisfies Array<
  Method | Extract<AuxMethod, "head">
>;

/**
 * @desc Methods usable on the client side, available via generated Integration and Documentation
 * @see withHead
 * */
export type ClientMethod = (typeof clientMethods)[number];

export const isMethod = (subject: string): subject is Method =>
  (methods as string[]).includes(subject);
