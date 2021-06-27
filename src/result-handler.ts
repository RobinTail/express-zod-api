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

export interface ResultHandlerDefinition<POS extends z.ZodTypeAny, NEG extends z.ZodTypeAny> {
  getPositiveResponse: <OUT extends z.ZodLazy<IOSchema>>(output: OUT) => POS,
  getNegativeResponse: () => NEG,
  resultHandler: ResultHandler<z.output<POS> | z.output<NEG>>;
}

export const createResultHandler = <POS extends z.ZodTypeAny, NEG extends z.ZodTypeAny>(
  definition: ResultHandlerDefinition<POS, NEG>
) => definition;

export const defaultResultHandler = createResultHandler({
  getPositiveResponse: <OUT extends z.ZodLazy<IOSchema>>(output: OUT) => z.object({
    status: z.literal('success'),
    data: output.schema,
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
