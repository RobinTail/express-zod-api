import * as express from 'express';
import * as z from 'zod';
import {InnerTypeOfFunction} from 'zod/lib/cjs/types/function';
import {ZodIssueCode} from 'zod/lib/cjs/ZodError';

type ZodObject = z.ZodObject<z.ZodRawShape>;
type RawHandlerImplementation<
  IN extends ZodObject,
  OUT extends ZodObject
> = InnerTypeOfFunction<z.ZodTuple<[IN, typeof handlerOptions]>, OUT>;

const handlerOptions = z.object({
  path: z.string(),
  urlParams: z.record(z.any()), // ParamsDictionary
  query: z.record(z.any()), // ParsedQs
  headers: z.record(z.any()), // IncomingHttpHeaders
});

const createHandlerParams = (params: ZodObject) => z.tuple([params, handlerOptions]);
export const createHandler = <
  IN extends ZodObject,
  OUT extends ZodObject,
  F extends RawHandlerImplementation<IN, OUT>
>({params, returns, implementation}: {
  params: IN,
  returns: OUT,
  implementation: F
}) => {
  return z.function(
    createHandlerParams(params),
    returns
  ).implement(implementation);
}

export type Handler = ReturnType<typeof createHandler>;

const createErrorMessage = (err: Error): string => {
  return err instanceof z.ZodError
    ? err.issues.map((issue) =>
      issue.code === ZodIssueCode.invalid_arguments
        ? issue.argumentsError.errors.map((e) =>
          `${e.path.slice(1).join('/')}: ${e.message}`).join('; ')
        : issue.message).join('; ')
    : err.message;
}

const replySuccess = (res: express.Response, result: ZodObject) => {
  res.status(200).type('json').send(result);
}

const replyError = (res: express.Response, err: Error) => {
  res.status(500).type('json').send({
    error: createErrorMessage(err),
  });
}

export const tryHandler = ({req, res, handler}: {
  req: express.Request,
  res: express.Response,
  handler: Handler
}) => {
  try {
    const result = handler(req.body, {
      path: req.path,
      urlParams: req.params,
      query: req.query,
      headers: req.headers,
    });
    replySuccess(res, result);
  } catch (err) {
    replyError(res, err);
  }
}
