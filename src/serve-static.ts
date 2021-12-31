import { static as _serveStatic } from "express";

type OriginalStatic = typeof _serveStatic;
export type StaticHandler = ReturnType<OriginalStatic>;

export class ServeStatic {
  public params: Parameters<OriginalStatic>;

  constructor(...params: Parameters<OriginalStatic>) {
    this.params = params;
  }
}
