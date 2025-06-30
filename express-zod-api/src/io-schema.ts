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
  (current && inc ? current.and(inc) : current || inc) as SelectiveIntersection<
    Current,
    Inc
  >;

export type ConditionalIntersection<
  Current extends IOSchema | undefined,
  Inc extends IOSchema,
> = z.ZodIntersection<Current extends IOSchema ? Current : Inc, Inc>;

export const ensureConditionalIntersection = <
  Current extends IOSchema | undefined,
  Inc extends IOSchema,
>(
  current: Current,
  inc: Inc,
) =>
  (current ? current.and(inc) : inc) as ConditionalIntersection<Current, Inc>;
