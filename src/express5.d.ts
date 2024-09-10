/**
 * @fileOverview Temporary adjustment to the Express 5 type declarations
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/69846/files#diff-5962769e8693df44c9e1083881fb1da149a67262026db939b7430536d514e7af
 * */
/* eslint-disable allowed/dependencies -- this is DTS */
/* eslint-disable @typescript-eslint/no-explicit-any -- copying as is */
import { ParsedQs } from "qs";
import {
  NextFunction,
  ParamsDictionary,
  Request,
  Response,
} from "express-serve-static-core";

declare module "express-serve-static-core" {
  export interface RequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
  > {
    (
      req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
      res: Response<ResBody, LocalsObj>,
      next: NextFunction,
    ): void | Promise<void>;
  }

  export type ErrorRequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
  > = (
    err: any,
    req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
    res: Response<ResBody, LocalsObj>,
    next: NextFunction,
  ) => void | Promise<void>;
}
