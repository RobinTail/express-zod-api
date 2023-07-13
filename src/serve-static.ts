import express from "express";

type OriginalStatic = typeof express.static;
export type StaticHandler = ReturnType<OriginalStatic>;

export class ServeStatic {
  public params: Parameters<OriginalStatic>;

  constructor(...params: Parameters<OriginalStatic>) {
    this.params = params;
  }

  public apply(
    path: string,
    cb: (path: string, handler: StaticHandler) => void,
  ): void {
    return cb(path, express.static(...this.params));
  }
}
