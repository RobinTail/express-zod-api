import { bench } from "vitest";
import { z } from "zod";
import { parseMaybeAsync } from "../src/common-helpers.ts";

const makeUncompiled = () =>
  z
    .object({
      name: z.string().min(1),
      age: z.number().int(),
    })
    .and(
      z.object({
        auth: z.object({ userId: z.uuid() }),
      }),
    );

describe("building", () => {
  bench("compiled", () => {
    z.compile(makeUncompiled());
  });

  bench("uncompiled", () => {
    makeUncompiled();
  });
});

describe("parsing", () => {
  const uncompiledSchema = makeUncompiled();
  const compiledSchema = z.compile(uncompiledSchema);
  const payload = {
    name: "Jane",
    age: 32,
    auth: { userId: "cd9f9b45-e8f9-4c45-8eaf-3c9d8c9b7f41" },
  };

  bench("compiled", async () => {
    await parseMaybeAsync(compiledSchema, payload, {
      trySyncValidation: true,
    });
  });

  bench("uncompiled", async () => {
    await parseMaybeAsync(uncompiledSchema, payload, {
      trySyncValidation: true,
    });
  });
});
