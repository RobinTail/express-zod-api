import {z, createHttpError, defaultEndpointsFactory} from '../../src';
import {EndpointResponse} from '../../src/endpoint';
import {methodProviderMiddleware} from '../middlewares';

enum Status {
  OK = "That's ok",
  Warning = 'Some kind of warning'
}

export const getUserEndpoint = defaultEndpointsFactory
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

// @todo remove
type RRR3 = EndpointResponse<typeof getUserEndpoint>;
