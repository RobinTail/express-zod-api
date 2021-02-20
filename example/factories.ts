import * as z from 'zod';
import {EndpointsFactory} from '../src/endpoints-factory';
import createHttpError = require('http-errors');

export const endpointsFactory = new EndpointsFactory();

export const keyAndTokenAuthenticatedEndpointsFactory = endpointsFactory.addMiddleware({
  input: z.object({
    key: z.string().nonempty()
  }),
  middleware: ({input: {key}, request, logger}) => {
    logger.debug('Checking the key and token...');
    return new Promise<{token: string}>((resolve, reject) => {
      if (key === '123' && request.headers['token'] === '456') {
        resolve({token: request.headers['token']});
      } else {
        reject(createHttpError(403, 'Invalid token'));
      }
    });
  }
})
