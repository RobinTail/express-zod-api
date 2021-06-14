import {Request, Response} from 'express';
import {Logger} from 'winston';
import {getStatusCodeFromError, getMessageFromError} from './helpers';

type DefaultResponse<OUT> = {
  status: 'success',
  data: OUT
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
    const result: DefaultResponse<typeof output> = { status: 'success', data: output };
    response.status(200).json(result);
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
  const result: DefaultResponse<never> = {
    status: 'error',
    error: { message: getMessageFromError(error) }
  };
  response.status(statusCode).json(result);
};
