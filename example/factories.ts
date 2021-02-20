import * as z from 'zod';
import {EndpointsFactory} from '../src';
import * as createHttpError from 'http-errors';

export const endpointsFactory = new EndpointsFactory();

export const keyAndTokenAuthenticatedEndpointsFactory = endpointsFactory.addMiddleware({
  input: z.object({
    key: z.string().nonempty()
  }),
  middleware: ({input: {key}, request, logger}) => {
    logger.debug('Checking the key and token...');
    return new Promise<{token: string}>((resolve, reject) => {
      if (key !== '123') {
        return reject(createHttpError(401, 'Invalid key'));
      }
      if (request.headers['token'] !== '456') {
        return reject(createHttpError(401, 'Invalid token'));
      }
      resolve({token: request.headers['token']});
    });
  }
})
