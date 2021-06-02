import {z, createHttpError} from '../../src';
import {keyAndTokenAuthenticatedEndpointsFactory} from '../factories';

enum Status {
  Updated = 'Success',
  Delayed = "I'll fix it later"
}

export const setUserEndpoint = keyAndTokenAuthenticatedEndpointsFactory.build({
  method: 'post',
  description: 'example user update endpoint',
  input: z.object({
    id: z.number().int().nonnegative(),
    name: z.string().nonempty()
  }),
  output: z.object({
    status: z.nativeEnum(Status),
  }),
  handler: async ({input: {id, name, key}, options: {token}, logger}) => {
    logger.debug(`id, key and token: ${id}, ${key}, ${token}`);
    if (id < 10) {
      return {
        status: Status.Updated,
        name
      };
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return {
      status: Status.Delayed,
      name
    };
  }
});
