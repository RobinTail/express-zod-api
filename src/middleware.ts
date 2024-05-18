import { NextFunction, Request, Response } from "express";
import { HttpError } from "http-errors";
import { z } from "zod";
import { hasTransformationOnTop } from "./deep-checks";
import { FlatObject } from "./common-helpers";
import { IOSchemaError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { ActualLogger } from "./logger";
import assert from "node:assert/strict";

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: ActualLogger;
}

type Middleware<IN, OPT, OUT> = (
  params: MiddlewareParams<IN, OPT>,
) => Promise<OUT>;

interface MiddlewareCreationProps<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
> {
  input: IN;
  security?: LogicalContainer<
    Security<Extract<keyof z.input<IN>, string>, SCO>
  >;
  middleware: Middleware<z.output<IN>, OPT, OUT>;
}

export interface MiddlewareDefinition<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
> extends MiddlewareCreationProps<IN, OPT, OUT, SCO> {
  type: "proprietary" | "express";
}

export type AnyMiddlewareDef = MiddlewareDefinition<any, any, any, any>;

export const createMiddleware = <
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
>(
  props: MiddlewareCreationProps<IN, OPT, OUT, SCO>,
): MiddlewareDefinition<IN, OPT, OUT, SCO> => {
  assert(
    !hasTransformationOnTop(props.input),
    new IOSchemaError(
      "Using transformations on the top level of middleware input schema is not allowed.",
    ),
  );
  return {
    ...props,
    type: "proprietary",
  };
};

export type ExpressMiddleware<R extends Request, S extends Response> = (
  request: R,
  response: S,
  next: NextFunction,
) => void | Promise<void>;

export interface ExpressMiddlewareFeatures<
  R extends Request,
  S extends Response,
  OUT extends FlatObject,
> {
  provider?: (request: R, response: S) => OUT | Promise<OUT>;
  transformer?: (err: Error) => HttpError | Error;
}
