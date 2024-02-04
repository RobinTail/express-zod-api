import { z } from "zod";
import { ez } from "../../src";
import { Emission } from "../../src/actions-factory";

export const onTime = {
  schema: z.tuple([ez.dateOut()]),
} satisfies Emission;
