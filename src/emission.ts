import { z } from "zod";

export interface Emission {
  schema: z.AnyZodTuple;
  ack?: z.AnyZodTuple;
}

export interface EmissionMap {
  [event: string]: Emission;
}

export const createEmission = <T extends EmissionMap>(def: T) => def;
