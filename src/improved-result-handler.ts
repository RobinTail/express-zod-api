import { z } from "zod";
import { ApiResponse } from "./api-response";
import { IOSchema } from "./io-schema";
import { ResultHandler } from "./result-handler";

type Setup = Readonly<
  [ApiResponse<z.ZodTypeAny>, ...ApiResponse<z.ZodTypeAny>[]]
>;

type SetupUnion<T extends Setup> = z.output<T[number]["schema"]>;

interface SpecialDefinition<POS extends Setup, NEG extends Setup> {
  getPositiveResponse: (output: IOSchema) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<SetupUnion<POS> | SetupUnion<NEG>>;
}

export const createSpecialResultHandler = <
  POS extends Setup,
  NEG extends Setup,
>(
  definition: SpecialDefinition<POS, NEG>,
) => definition;

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
