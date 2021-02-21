import {z, createHttpError} from '../../src';
import {keyAndTokenAuthenticatedEndpointsFactory} from '../factories';

enum Status {
  Updated = 'Success',
  Delayed = "I'll fix it later"
}

export const setUserEndpoint = keyAndTokenAuthenticatedEndpointsFactory.build({
  methods: ['post'],
  input: z.object({
    id: z.number().int().nonnegative(),
    name: z.string().nonempty()
  }),
  output: z.object({
    status: z.nativeEnum(Status),
  }),
  handler: ({input: {id, name, key}, options: {token}, logger}) => {
    logger.debug(`id, key and token: ${id}, ${key}, ${token}`);
    if (id < 10) {
      return Promise.resolve({
        status: Status.Updated,
        name
      });
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return Promise.resolve({
      status: Status.Delayed,
      name
    });
  }
})
