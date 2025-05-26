import { z } from "zod/v4";

export const ezBufferBrand = Symbol("Buffer");

export const buffer = () =>
  z
    .custom<Buffer>((subject) => Buffer.isBuffer(subject), {
      error: "Expected Buffer",
    })
    .brand(ezBufferBrand as symbol);
