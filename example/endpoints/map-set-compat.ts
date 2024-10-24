import { z } from "zod";
import { defaultEndpointsFactory } from "../../src";

/** @desc This endpoint demonstrates Map and Set serialization feature */
export const mapSetCompatEndpoint = defaultEndpointsFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    map: z.map(z.string(), z.boolean()),
    set: z.set(z.number().int()),
  }),
  handler: async () => ({
    map: new Map<string, boolean>()
      .set("sampleKey", true)
      .set("anotherOne", false),
    set: new Set<number>().add(123).add(456).add(123), // ensures unique values!
  }),
});
