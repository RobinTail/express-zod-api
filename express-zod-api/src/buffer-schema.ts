import { z } from "zod";
import { brandProperty } from "./metadata.ts";

export const ezBufferBrand = Symbol("Buffer");

export const buffer = () =>
  z
    .custom<Buffer>((subject) => Buffer.isBuffer(subject), {
      error: "Expected Buffer",
    })
    .meta({ [brandProperty]: ezBufferBrand });
