import * as z from 'zod';
import {EndpointBuilder} from '../endpoint';
import {logger} from '../logger';
import * as createHttpError from 'http-errors';

const params = z.object({
  id: z.number().int().nonnegative(),
});

const returns = z.object({
  status: z.enum(['OK', 'Warning']),
  name: z.string(),
  meta: z.string()
});

export const getUserEndpoint = new EndpointBuilder().addMiddleware({
  input: z.object({
    key: z.string().optional()
  }),
  middleware: ({input}) => {
    return Promise.resolve({
      isValidKey: input.key === '123'
    });
  }
}).build({
  input: params,
  output: returns,
  handler: ({input: {id, key}, options}) => {
    logger.debug('Options', options);
    const name = 'sample';
    const meta = `Your key is ${options.isValidKey ? 'valid' : 'invalid'}: ${key}`;
    if (id < 10) {
      return Promise.resolve({
        status: returns.shape.status.enum.OK as z.infer<typeof returns.shape.status>,
        name, meta
      });
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return Promise.resolve({
      status: returns.shape.status.enum.Warning as z.infer<typeof returns.shape.status>,
      name, meta
    });
  }
})
