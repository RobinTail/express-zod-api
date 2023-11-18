import { NextFunction, Request, Response } from "express";
import { HttpError } from "http-errors";
import { z } from "zod";
import { FlatObject, hasTopLevelTransformingEffect } from "./common-helpers";
import { IOSchemaError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { AbstractLogger, CommonConfig } from "./config-type";

interface MiddlewareParams<IN, OPT, LOG> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: LOG;
}

type Middleware<IN, OPT, OUT, LOG> = (
  params: MiddlewareParams<IN, OPT, LOG>,
) => Promise<OUT>;

interface MiddlewareCreationProps<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
  LOG extends AbstractLogger,
> {
  input: IN;
  security?: LogicalContainer<Security<keyof z.input<IN> & string, SCO>>;
  config?: CommonConfig<any, LOG>;
  middleware: Middleware<z.output<IN>, OPT, OUT, LOG>;
}

export interface MiddlewareDefinition<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
  LOG extends AbstractLogger,
> extends MiddlewareCreationProps<IN, OPT, OUT, SCO, LOG> {
  type: "proprietary" | "express";
}

export type AnyMiddlewareDef = MiddlewareDefinition<any, any, any, any, any>;

export const createMiddleware = <
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject,
  SCO extends string,
  LOG extends AbstractLogger,
>(
  props: MiddlewareCreationProps<IN, OPT, OUT, SCO, LOG>,
): MiddlewareDefinition<IN, OPT, OUT, SCO, LOG> => {
  if (hasTopLevelTransformingEffect(props.input)) {
    throw new IOSchemaError(
      "Using transformations on the top level of middleware input schema is not allowed.",
    );
  }
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
