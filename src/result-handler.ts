import {Request, Response} from 'express';
import {HttpError} from 'http-errors';
import {Logger} from 'winston';
import * as z from 'zod';

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

export const defaultResultHandler = ({error, request, response, input, output, logger}: ResultHandlerParams) => {
  let resultJson: ApiResponse<any>;
  if (error) {
    let statusCode = 500;
    if (error instanceof HttpError) {
      statusCode = error.statusCode;
    }
    if (error instanceof z.ZodError) {
      statusCode = 400;
    }
    if (statusCode === 500) {
      logger.error(
        `Internal server error\n` +
        `${error.stack}\n` +
        `URL: ${request.url}\n` +
        `Payload: ${JSON.stringify(input, null, 2)}`,
        '  '
      );
    }
    response.status(statusCode);
    resultJson = {
      status: 'error',
      error: {
        message: error instanceof z.ZodError
          ? error.issues.map(({path, message}) =>
            `${path.join('/')}: ${message}`).join('; ')
          : error.message,
      }
    };
  } else {
    resultJson = {
      status: 'success',
      data: output
    };
  }
  response.json(resultJson);
}
