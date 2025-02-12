import express from "express";
import { Routable } from "./routable";

type OriginalStatic = typeof express.static;
export type StaticHandler = ReturnType<OriginalStatic>;

export class ServeStatic extends Routable {
  public params: Parameters<OriginalStatic>;

  constructor(...params: Parameters<OriginalStatic>) {
    super();
    this.params = params;
  }

  public override clone() {
    return new ServeStatic(...this.params) as this;
  }

  public apply(
    path: string,
    cb: (path: string, handler: StaticHandler) => void,
  ): void {
    return cb(path, express.static(...this.params));
  }
}
