import { static as _serveStatic } from "express";

type OriginalStatic = typeof _serveStatic;
export type StaticHandler = ReturnType<OriginalStatic> & {
  _typeGuard: "StaticHandler";
};

export const serveStatic = (...params: Parameters<OriginalStatic>) =>
  _serveStatic(...params) as StaticHandler;
