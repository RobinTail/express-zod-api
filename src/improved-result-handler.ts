import { z } from "zod";
import { ApiResponse } from "./api-response";
import { IOSchema } from "./io-schema";
import { ResultHandler, ResultHandlerDefinition } from "./result-handler";

type Setup = [ApiResponse<z.ZodTypeAny>, ...ApiResponse<z.ZodTypeAny>[]];

type SetupUnion<T extends Setup> = z.output<T[number]["schema"]>;

interface SpecialDefinition<POS extends Setup, NEG extends Setup> {
  getPositiveResponse: (output: IOSchema) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<SetupUnion<POS> | SetupUnion<NEG>>;
}

export function createSpecialResultHandler<
  POS extends Setup,
  NEG extends Setup,
>(definition: SpecialDefinition<POS, NEG>): typeof definition;

export function createSpecialResultHandler<
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
>(definition: ResultHandlerDefinition<POS, NEG>): typeof definition;

export function createSpecialResultHandler(
  definition: SpecialDefinition<any, any> | ResultHandlerDefinition<any, any>,
) {
  return definition;
}

createSpecialResultHandler({
  getPositiveResponse: () => [
    { statusCode: 200, schema: z.literal("ok") },
    { statusCode: 201, schema: z.literal("kinda") },
  ],
  getNegativeResponse: () => [
    { statusCode: 400, schema: z.literal("error") },
    { statusCode: 500, schema: z.literal("failure") },
  ],
  handler: ({ response }) => {
    response.status(200).send("error");
  },
});

createSpecialResultHandler({
  getPositiveResponse: (output: IOSchema) =>
    z.object({
      status: z.literal("success"),
      data: output,
    }),
  getNegativeResponse: () => ({
    schema: z.object({
      status: z.literal("error"),
      error: z.object({
        message: z.string(),
      }),
    }),
  }),
  handler: ({ response }) => {
    response.status(500).json({
      status: "error",
      error: { message: "test" },
    });
  },
});
