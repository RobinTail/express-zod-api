import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {FlatObject, ObjectSchema} from './helpers';

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: Logger;
}

type Middleware<IN, OPT, OUT> = (params: MiddlewareParams<IN, OPT>) => Promise<OUT>;

export interface MiddlewareDefinition<IN extends ObjectSchema, OPT, OUT extends FlatObject> {
  input: IN;
  middleware: Middleware<z.infer<IN>, OPT, OUT>;
}

export const createMiddleware = <IN extends ObjectSchema, OPT, OUT extends FlatObject>(
  definition: MiddlewareDefinition<IN, OPT, OUT>
) => definition;
