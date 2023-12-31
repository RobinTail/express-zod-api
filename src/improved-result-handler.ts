import { z } from "zod";
import { MultipleApiResponses } from "./api-response";
import { IOSchema } from "./io-schema";
import { ResultHandler, ResultHandlerDefinition } from "./result-handler";

interface StatusDependingDefinition<
  POS extends MultipleApiResponses,
  NEG extends MultipleApiResponses,
> {
  getPositiveResponse: (output: IOSchema) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<
    z.output<POS[number]["schema"]> | z.output<NEG[number]["schema"]>
  >;
}

export function createResultHandler<
  POS extends MultipleApiResponses,
  NEG extends MultipleApiResponses,
>(definition: StatusDependingDefinition<POS, NEG>): typeof definition;

export function createResultHandler<
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
>(definition: ResultHandlerDefinition<POS, NEG>): typeof definition;

export function createResultHandler(definition: unknown) {
  return definition;
}

createResultHandler({
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

createResultHandler({
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
