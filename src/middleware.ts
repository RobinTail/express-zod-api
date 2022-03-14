import { Request, Response } from "express";
import { HttpError } from "http-errors";
import { Logger } from "winston";
import { z } from "zod";
import { FlatObject, IOSchema } from "./common-helpers";

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: Logger;
}

type Middleware<IN, OPT, OUT> = (
  params: MiddlewareParams<IN, OPT>
) => Promise<OUT>;

export interface MiddlewareDefinition<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject
> {
  input: IN;
  middleware: Middleware<z.output<IN>, OPT, OUT>;
}

export type AnyMiddlewareDef = MiddlewareDefinition<
  IOSchema<"strip">,
  any,
  any
>;

export const createMiddleware = <
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject
>(
  definition: MiddlewareDefinition<IN, OPT, OUT>
) => definition;

export type ExpressMiddleware<R extends Request, S extends Response> = (
  request: R,
  response: S,
  next: (error?: any) => void
) => void | Promise<void>;

export interface ExpressMiddlewareFeatures<
  R extends Request,
  S extends Response,
  OUT extends FlatObject
> {
  provider?: (request: R, response: S) => OUT | Promise<OUT>;
  transformer?: (err: Error) => HttpError | Error;
}
