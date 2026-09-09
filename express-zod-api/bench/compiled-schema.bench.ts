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

test("building", async ({ bench }) => {
  await bench.compare(
    bench("compiled", () => {
      z.compile(makeUncompiled());
    }),
    bench("uncompiled", () => {
      makeUncompiled();
    }),
  );
});

test("parsing", async ({ bench }) => {
  const uncompiledSchema = makeUncompiled();
  const compiledSchema = z.compile(uncompiledSchema);
  const payload = {
    name: "Jane",
    age: 32,
    auth: { userId: "cd9f9b45-e8f9-4c45-8eaf-3c9d8c9b7f41" },
  };

  await bench.compare(
    bench("compiled", async () => {
      await parseMaybeAsync(compiledSchema, payload, {
        trySyncValidation: true,
      });
    }),
    bench("uncompiled", async () => {
      await parseMaybeAsync(uncompiledSchema, payload, {
        trySyncValidation: true,
      });
    }),
  );
});
