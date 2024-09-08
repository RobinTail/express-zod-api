import { z } from "zod";
import { ez } from "express-zod-api";

export const productPriceSchema = z.object({
  price: z.number(),
  date: ez.dateOut(),
});
