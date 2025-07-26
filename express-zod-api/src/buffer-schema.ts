import { z } from "zod";

export const ezBufferBrand = Symbol("Buffer");

export const buffer = () =>
  z
    .custom<Buffer>((subject) => Buffer.isBuffer(subject), {
      error: "Expected Buffer",
    })
    .brand(ezBufferBrand as symbol);
