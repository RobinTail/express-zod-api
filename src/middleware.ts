import {Request, Response} from 'express';
import {Logger} from 'winston';
import * as z from 'zod';
import {Unshape} from './helpers';

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: Logger;
}

type Middleware<IN, OPT, OUT> = (params: MiddlewareParams<IN, OPT>) => Promise<OUT>;

export interface MiddlewareDefinition<IN extends z.ZodRawShape, OPT, OUT> {
  input: z.ZodObject<IN>;
  middleware: Middleware<Unshape<IN>, OPT, OUT>;
}
