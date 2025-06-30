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
export type FinalIntersection<
  Current extends IOSchema | undefined,
  Inc extends IOSchema,
> = z.ZodIntersection<Current extends IOSchema ? Current : Inc, Inc>;

/** Makes the Endpoint input schema */
export const makeFinalIntersection = <
  Current extends IOSchema | undefined,
  Inc extends IOSchema,
>(
  current: Current,
  inc: Inc,
) => (current ? current.and(inc) : inc) as FinalIntersection<Current, Inc>;
