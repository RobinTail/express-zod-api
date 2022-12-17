import { z } from "zod";
export type SchemaDepicter<T extends z.ZodTypeAny, U> = (params: {
  schema: T;
  initial?: U;
  isResponse: boolean;
}) => U;
