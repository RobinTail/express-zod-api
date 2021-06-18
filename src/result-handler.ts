import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {getMessageFromError, getStatusCodeFromError, IOSchema} from './helpers';

interface ResultHandlerParams<RES> {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response<RES>;
  logger: Logger
}

type ResultHandler<RES> = (params: ResultHandlerParams<RES>) => void | Promise<void>;

export interface ResultHandlerDefinition<SUCCESS extends z.ZodTypeAny, ERROR extends z.ZodTypeAny> {
  getPositiveResponse: (output: IOSchema) => SUCCESS,
  getNegativeResponse: () => ERROR,
  resultHandler: ResultHandler<z.output<SUCCESS> | z.output<ERROR>>;
}

export const createResultHandler = <SUCCESS extends z.ZodTypeAny, ERROR extends z.ZodTypeAny>(
  definition: ResultHandlerDefinition<SUCCESS, ERROR>
) => definition;

export const defaultResultHandler = createResultHandler({
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
