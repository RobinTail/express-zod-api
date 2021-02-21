import {createMiddleware, Method, createHttpError, z} from '../src';

export const authMiddleware = createMiddleware({
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
});

export const methodProviderMiddleware = createMiddleware({
  input: z.object({}).nonstrict(),
  middleware: ({request}) => Promise.resolve({
    method: request.method.toLowerCase() as Method,
  })
});
