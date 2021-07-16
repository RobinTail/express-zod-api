import {z, createHttpError} from '../../src';
import {keyAndTokenAuthenticatedEndpointsFactory} from '../factories';

export const setUserEndpoint = keyAndTokenAuthenticatedEndpointsFactory.build({
  method: 'post',
  description: 'example user update endpoint',
  input: z.object({
    id: z.number().int().nonnegative(),
    name: z.string().nonempty()
  }),
  output: z.object({
    name: z.string(),
    timestamp: z.number()
  }),
  handler: async ({input: {id, name, key}, options: {token}, logger}) => {
    logger.debug(`id, key and token: ${id}, ${key}, ${token}`);
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return {
      timestamp: Date.now(),
      name
    };
  }
});
