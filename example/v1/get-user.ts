import {z, createHttpError} from '../../src';
import {endpointsFactory} from '../factories';
import {methodProviderMiddleware} from '../middlewares';

enum Status {
  OK = "That's ok",
  Warning = 'Some kind of warning'
}

export const getUserEndpoint = endpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: 'get',
    description: 'example user retrieval endpoint',
    input: z.object({
      id: z.string().transform((id) => parseInt(id, 10))
    }),
    output: z.object({
      status: z.nativeEnum(Status),
      name: z.string(),
    }),
    handler: async ({input: {id}, options: {method}, logger}) => {
      logger.debug(`Requested id: ${id}, method ${method}`);
      const name = 'John Doe';
      if (id < 10) {
        return {
          status: Status.OK,
          name
        };
      }
      if (id > 100) {
        throw createHttpError(404, 'User not found');
      }
      return {
        status: Status.Warning,
        name
      };
    }
  });
