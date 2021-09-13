import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {ApiResponse, createApiResponse} from './api-response';
import {
  getMessageFromError,
  getStatusCodeFromError,
  IOSchema,
  markOutput
} from './helpers';

interface ResultHandlerParams<RES> {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response<RES>;
  logger: Logger;
}

type ResultHandler<RES> = (params: ResultHandlerParams<RES>) => void | Promise<void>;

export interface ResultHandlerDefinition<POS extends ApiResponse, NEG extends ApiResponse> {
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) => POS,
  getNegativeResponse: () => NEG,
  handler: ResultHandler<z.output<POS['schema']> | z.output<NEG['schema']>>;
}

export const createResultHandler = <POS extends ApiResponse, NEG extends ApiResponse>(
  definition: ResultHandlerDefinition<POS, NEG>
) => definition;

export const defaultResultHandler = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) => createApiResponse(z.object({
    status: z.literal('success'),
    data: markOutput(output)
  })),
  getNegativeResponse: () => createApiResponse(z.object({
    status: z.literal('error'),
    error: z.object({
      message: z.string()
    })
  })),
  handler: ({error, input, output, request, response, logger}) => {
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
