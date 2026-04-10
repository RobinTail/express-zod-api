import { z } from "zod";
import { brandProperty } from "./brand";

export const ezBufferBrand = Symbol("Buffer");

export const buffer = () =>
  z
    .custom<Buffer>((subject) => Buffer.isBuffer(subject), {
      error: "Expected Buffer",
    })
    .meta({ [brandProperty]: ezBufferBrand });
