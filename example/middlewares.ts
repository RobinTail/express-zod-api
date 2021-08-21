import {createMiddleware, Method, createHttpError, z} from '../src';

export const authMiddleware = createMiddleware({
  input: z.object({
    key: z.string().nonempty()
  }),
  middleware: async ({input: {key}, request, logger}) => {
    logger.debug('Checking the key and token...');
    if (key !== '123') {
      throw createHttpError(401, 'Invalid key');
    }
    if (request.headers['token'] !== '456') {
      throw createHttpError(401, 'Invalid token');
    }
    return {token: request.headers['token']};
  }
});

export const methodProviderMiddleware = createMiddleware({
  input: z.object({}),
  middleware: async ({request}) => ({
    method: request.method.toLowerCase() as Method,
  })
});
