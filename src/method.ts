import type { IRouter } from "express";

export const methods = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
] satisfies Array<keyof IRouter>;

export type Method = (typeof methods)[number];

export type AuxMethod = Extract<keyof IRouter, "options">;
