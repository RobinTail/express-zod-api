import { z } from "zod";
import { parseMaybeAsync } from "../src/common-helpers.ts";

test.for([
  [z.string(), "sync"],
  [z.string().refine(async () => true), "async"],
] as const)("Parsing $1 schemas", async ([schema], { bench }) => {
  await bench.compare(
    bench(".parseAsync()", async () => {
      await schema.parseAsync("");
    }),
    bench("parseMaybeAsync()", async () => {
      await parseMaybeAsync(schema, "", {
        trySyncValidation: true,
        cors: false,
      });
    }),
  );
});
