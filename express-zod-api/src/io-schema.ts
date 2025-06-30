import { z } from "zod/v4";

type Base = object & { [Symbol.iterator]?: never };

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema = z.ZodType<Base>;

/** EndpointsFactory schema extended type when adding a Middleware */
export type SelectiveIntersection<
  Current extends IOSchema | undefined,
  Inc extends IOSchema | undefined,
> = Current extends IOSchema
  ? Inc extends IOSchema
    ? z.ZodIntersection<Current, Inc>
    : Current
  : Inc;

/** Make a schema for EndpointsFactory extended with a Middleware */
export const ensureSelectiveIntersection = <
  Current extends IOSchema | undefined,
  Inc extends IOSchema | undefined,
>(
  current: Current,
  inc: Inc,
) =>
  (current && inc ? current.and(inc) : current || inc) as SelectiveIntersection<
    Current,
    Inc
  >;

/** The Endpoint input schema type, condition wrapped into schema to make it z.output-compatible */
export type FinalInputSchema<
  FIN extends IOSchema | undefined,
  BIN extends IOSchema,
> = z.ZodIntersection<FIN extends IOSchema ? FIN : BIN, BIN>;

/** Makes the Endpoint input schema */
export const makeFinalInputSchema = <
  FIN extends IOSchema | undefined,
  BIN extends IOSchema,
>(
  factorySchema: FIN,
  buildSchema: BIN,
) =>
  (factorySchema
    ? factorySchema.and(buildSchema)
    : buildSchema) as FinalInputSchema<FIN, BIN>;
