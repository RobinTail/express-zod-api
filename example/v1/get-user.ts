import * as z from 'zod';
import * as createHttpError from 'http-errors';
import {endpointsFactory} from '../factories';

enum Status {
  OK = "That's ok",
  Warning = 'Some kind of warning'
}

export const getUserEndpoint = endpointsFactory.build({
  methods: ['get'],
  input: z.object({
    id: z.string().transform((id) => parseInt(id, 10))
  }),
  output: z.object({
    status: z.nativeEnum(Status),
    name: z.string(),
  }),
  handler: ({input: {id}, options, logger}) => {
    logger.debug(`Requested id: ${id}`);
    const name = 'John Doe';
    if (id < 10) {
      return Promise.resolve({
        status: Status.OK,
        name
      });
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return Promise.resolve({
      status: Status.Warning,
      name
    });
  }
})
