import { bench } from "vitest";
import { z } from "zod";
import { parseMaybeAsync } from "../src/common-helpers.ts";

describe.each([
  [z.string(), "sync"],
  [z.string().refine(async () => true), "async"],
])("Parsing $1 schemas", (schema) => {
  bench(".parseAsync()", async () => {
    await schema.parseAsync("");
  });

  bench("parseMaybeAsync()", async () => {
    await parseMaybeAsync(schema, "");
  });
});
