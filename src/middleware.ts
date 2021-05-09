import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {FlatObject, IO} from './helpers';

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: Logger;
}

type Middleware<IN, OPT, OUT> = (params: MiddlewareParams<IN, OPT>) => Promise<OUT>;

export interface MiddlewareDefinition<IN extends IO, OPT, OUT extends FlatObject> {
  input: IN;
  middleware: Middleware<z.output<IN>, OPT, OUT>;
}

export const createMiddleware = <IN extends IO, OPT, OUT extends FlatObject>(
  definition: MiddlewareDefinition<IN, OPT, OUT>
) => definition;
