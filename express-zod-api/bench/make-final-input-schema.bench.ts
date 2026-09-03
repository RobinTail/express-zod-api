import { bench } from "vitest";
import { z } from "zod";
import { parseMaybeAsync } from "../src/common-helpers.ts";
import { makeFinalInputSchema, type IOSchema } from "../src/io-schema.ts";

const buildSchema: IOSchema = z.object({
  name: z.string().min(1),
  age: z.number().int(),
});

const factorySchema: IOSchema = z.object({
  auth: z.object({ userId: z.string().uuid() }),
});

const payloadWithoutFactory = { name: "Jane", age: 32 };
const makeUncompiled = (
  factory: IOSchema | undefined,
  build: IOSchema,
): IOSchema => (factory ? factory.and(build) : build);

describe("makeFinalInputSchema: without factory schema", () => {
  const compiledSchema = makeFinalInputSchema(undefined, buildSchema);
  const uncompiledSchema = makeUncompiled(undefined, buildSchema);

  bench("compiled: construction", () => {
    makeFinalInputSchema(undefined, buildSchema);
  });

  bench("uncompiled: construction", () => {
    makeUncompiled(undefined, buildSchema);
  });

  bench("compiled: parsing", async () => {
    await parseMaybeAsync(compiledSchema, payloadWithoutFactory, {
      trySyncValidation: true,
    });
  });

  bench("uncompiled: parsing", async () => {
    await parseMaybeAsync(uncompiledSchema, payloadWithoutFactory, {
      trySyncValidation: true,
    });
  });
});

describe("makeFinalInputSchema: with factory schema", () => {
  const compiledSchema = makeFinalInputSchema(factorySchema, buildSchema);
  const uncompiledSchema = makeUncompiled(factorySchema, buildSchema);
  const payloadWithFactory = {
    ...payloadWithoutFactory,
    auth: { userId: "cd9f9b45-e8f9-4c45-8eaf-3c9d8c9b7f41" },
  };

  bench("compiled: construction", () => {
    makeFinalInputSchema(factorySchema, buildSchema);
  });

  bench("uncompiled: construction", () => {
    makeUncompiled(factorySchema, buildSchema);
  });

  bench("compiled: parsing", async () => {
    await parseMaybeAsync(compiledSchema, payloadWithFactory, {
      trySyncValidation: true,
    });
  });

  bench("uncompiled: parsing", async () => {
    await parseMaybeAsync(uncompiledSchema, payloadWithFactory, {
      trySyncValidation: true,
    });
  });
});
