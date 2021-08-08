import {z, createHttpError, defaultEndpointsFactory} from '../../src';
import {methodProviderMiddleware} from '../middlewares';

export const getUserEndpoint = defaultEndpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: 'get',
    description: 'example user retrieval endpoint',
    input: z.object({
      id: z.string().regex(/\d+/).transform((id) => parseInt(id, 10))
    }),
    output: z.object({
      id: z.number().int().nonnegative(),
      name: z.string(),
    }),
    handler: async ({input: {id}, options: {method}, logger}) => {
      logger.debug(`Requested id: ${id}, method ${method}`);
      const name = 'John Doe';
      if (id > 100) {
        throw createHttpError(404, 'User not found');
      }
      return { id, name };
    }
  });
