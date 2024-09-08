import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { productPriceSchema } from "./product-schema.js";

export const getProductPricesEndpoint = defaultEndpointsFactory.build({
  method: "get",
  tag: "product",
  description: "Get all the product prices.",
  input: z.object({}),
  output: z.object({ items: z.array(productPriceSchema) }),
  handler: async () => {
    const items = [{ price: 100.54, date: new Date() }];
    return { items };
  },
});
