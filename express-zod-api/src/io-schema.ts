import * as R from "ramda";
import { z } from "zod/v4";
import { AbstractMiddleware } from "./middleware";

type Base = object & { [Symbol.iterator]?: never };

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema = z.ZodType<Base>;

export type SelectiveIntersection<
  Current extends IOSchema | undefined,
  Inc extends IOSchema | undefined,
> = Current extends IOSchema
  ? Inc extends IOSchema
    ? z.ZodIntersection<Current, Inc>
    : Current
  : Inc;

export const ensureSelectiveIntersection = <
  Current extends IOSchema | undefined,
  Inc extends IOSchema | undefined,
>(
  current: Current,
  inc: Inc,
) =>
  (current ? (inc ? current.and(inc) : current) : inc) as SelectiveIntersection<
    Current,
    Inc
  >;

export type ConditionalIntersection<
  Current extends IOSchema | undefined,
  Inc extends IOSchema,
> = z.ZodIntersection<Current extends IOSchema ? Current : Inc, Inc>;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @since 22.05.2025 does not mix examples in after switching to Zod 4
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema | undefined,
  IN extends IOSchema,
>(
  middlewares: AbstractMiddleware[],
  input: IN,
) =>
  R.pluck("schema", middlewares)
    .concat(input)
    .reduce((acc, schema) => acc.and(schema)) as ConditionalIntersection<
    MIN,
    IN
  >;
