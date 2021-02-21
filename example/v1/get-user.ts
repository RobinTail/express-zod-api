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
    methods: ['get'],
    input: z.object({
      id: z.string().transform((id) => parseInt(id, 10))
    }),
    output: z.object({
      status: z.nativeEnum(Status),
      name: z.string(),
    }),
    handler: ({input: {id}, options: {method}, logger}) => {
      logger.debug(`Requested id: ${id}, method ${method}`);
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
