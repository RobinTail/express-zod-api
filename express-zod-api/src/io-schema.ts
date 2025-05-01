import * as R from "ramda";
import { z } from "zod";
import { mixExamples } from "./metadata";
import { AbstractMiddleware } from "./middleware";

type Base = object & { [Symbol.iterator]?: never };

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema = z.ZodType<Base>;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @see mixExamples
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema,
  IN extends IOSchema,
>(
  middlewares: AbstractMiddleware[],
  input: IN,
): z.ZodIntersection<MIN, IN> => {
  const allSchemas: IOSchema[] = R.pluck("schema", middlewares);
  allSchemas.push(input);
  const finalSchema = allSchemas.reduce((acc, schema) => acc.and(schema));
  return allSchemas.reduce(
    (acc, schema) => mixExamples(schema, acc),
    finalSchema,
  ) as z.ZodIntersection<MIN, IN>;
};
