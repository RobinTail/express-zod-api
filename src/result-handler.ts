import {Request, Response} from 'express';
import {Logger} from 'winston';
import {getStatusCodeFromError, getMessageFromError} from './helpers';

type ApiResponse<T> = {
  status: 'success',
  data: T
} | {
  status: 'error',
  error: {
    message: string;
  }
};

interface ResultHandlerParams {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response;
  logger: Logger
}

export type ResultHandler = (params: ResultHandlerParams) => void | Promise<void>;

export const defaultResultHandler: ResultHandler = ({error, request, response, input, output, logger}) => {
  if (!error) {
    const result: ApiResponse<typeof output> = { status: 'success', data: output };
    response.status(200).json(result);
    return;
  }
  const statusCode = getStatusCodeFromError(error);
  if (statusCode === 500) {
    logger.error(
      'Internal server error\n' +
      `${error.stack}\n` +
      `URL: ${request.url}\n` +
      `Payload: ${JSON.stringify(input, undefined, 2)}`,
    );
  }
  const result: ApiResponse<any> = {
    status: 'error',
    error: { message: getMessageFromError(error) }
  };
  response.status(statusCode).json(result);
};
