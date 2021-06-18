import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {getMessageFromError, getStatusCodeFromError, IOSchema} from './helpers';

interface ResultHandlerParams<T> {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response<T>;
  logger: Logger
}

type ResultHandler<T> = (params: ResultHandlerParams<T>) => void | Promise<void>;

interface ResultHandlerDefinition<SUCCESS extends z.ZodTypeAny, ERROR extends z.ZodTypeAny> {
  getPositiveResponse: (output: IOSchema) => SUCCESS,
  getNegativeResponse: () => ERROR,
  resultHandler: ResultHandler<z.output<SUCCESS> | z.output<ERROR>>;
}

const createResultHandler = <SUCCESS extends z.ZodTypeAny, ERROR extends z.ZodTypeAny>(
  definition: ResultHandlerDefinition<SUCCESS, ERROR>
) => definition;

const defaultResultHandler = createResultHandler({
  getPositiveResponse: (output: IOSchema) => z.object({
    status: z.literal('success'),
    data: output,
  }),
  getNegativeResponse: () => z.object({
    status: z.literal('error'),
    error: z.object({
      message: z.string()
    })
  }),
  resultHandler: ({error, input, output, request, response, logger}) => {
    if (!error) {
      response.status(200).json({
        status: 'success' as const,
        data: output
      });
      return;
    }
    const statusCode = getStatusCodeFromError(error);
    if (statusCode === 500) {
      logger.error(
        `Internal server error\n${error.stack}\n`,
        {
          url: request.url,
          payload: input
        }
      );
    }
    response.status(statusCode).json({
      status: 'error' as const,
      error: { message: getMessageFromError(error) }
    });
  }
});
