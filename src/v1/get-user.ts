import * as z from 'zod';
import {EndpointsFactory} from '../endpoints-factory';
import {logger} from '../logger';
import * as createHttpError from 'http-errors';

const params = z.object({
  // for POST method:
  // id: z.number().int().nonnegative(),
  // for GET method:
  id: z.string().transform((id) => parseInt(id, 10))
});

enum Status {
  OK = "That's ok",
  Warning = 'Some kind of warning'
}

const returns = z.object({
  status: z.nativeEnum(Status),
  name: z.string(),
  meta: z.string()
});

export const getUserEndpoint = new EndpointsFactory().addMiddleware({
  input: z.object({
    key: z.string().optional()
  }),
  middleware: ({input}) => {
    return Promise.resolve({
      isValidKey: input.key === '123'
    });
  }
}).build({
  methods: ['get'],
  input: params,
  output: returns,
  handler: ({input: {id, key}, options}) => {
    logger.debug('ID: ' + (typeof id));
    logger.debug('Options', options);
    const name = 'John Doe';
    const meta = `Your key is ${options.isValidKey ? 'valid' : 'invalid'}: ${key}`;
    if (id < 10) {
      return Promise.resolve({
        status: Status.OK,
        name, meta
      });
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return Promise.resolve({
      status: Status.Warning,
      name, meta
    });
  }
})
