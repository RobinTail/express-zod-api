import {z, createHttpError, defaultEndpointsFactory, withMeta} from '../../src';
import {methodProviderMiddleware} from '../middlewares';

export const retrieveUserEndpoint = defaultEndpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: 'get',
    description: 'example user retrieval endpoint',
    input: withMeta(z.object({
      id: z.string().regex(/\d+/)
        .transform((id) => parseInt(id, 10))
        .describe('a numeric string containing the id of the user')
    })).example({ id: '12' }), // whole IO schema example
    output: withMeta(z.object({
      id: z.number().int().nonnegative(),
      name: z.string(),
    })).example({ // whole IO schema example
      id: 12,
      name: 'John Doe'
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
