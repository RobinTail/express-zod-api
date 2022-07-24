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

interface BasicSecurity {
  type: "basic";
}
interface BearerSecurity {
  type: "bearer";
  format?: "JWT" | string;
}
interface CustomHeaderSecurity {
  type: "header";
  name: string;
}
interface CookieSecurity {
  type: "cookie";
  name: string;
}
interface OpenIdSecurity {
  type: "openid";
  url: string;
}
/**
 * @todo add more fields here
 * @see https://swagger.io/docs/specification/authentication/oauth2/
 */
interface OAuth2Security {
  type: "oauth2";
}
type Security =
  | BasicSecurity
  | BearerSecurity
  | CustomHeaderSecurity
  | CookieSecurity
  | OpenIdSecurity
  | OAuth2Security;

export interface MiddlewareCreationProps<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject
> {
  input: IN;
  security?: Security | Security[];
  middleware: Middleware<z.output<IN>, OPT, OUT>;
}

export interface MiddlewareDefinition<
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject
> extends MiddlewareCreationProps<IN, OPT, OUT> {
  type: "proprietary" | "express";
}

export type AnyMiddlewareDef = MiddlewareDefinition<any, any, any>;

export const createMiddleware = <
  IN extends IOSchema<"strip">,
  OPT,
  OUT extends FlatObject
>(
  props: MiddlewareCreationProps<IN, OPT, OUT>
): MiddlewareDefinition<IN, OPT, OUT> => ({
  ...props,
  type: "proprietary",
});

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
