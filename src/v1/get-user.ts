import * as z from 'zod';
import {createHandler} from '../handler';
import {logger} from '../logger';
import * as createHttpError from 'http-errors';

const params = z.object({
  id: z.number().int().nonnegative(),
});

const returns = z.object({
  status: z.enum(['OK', 'Warning']),
  name: z.string()
});

export const getUserHandler = createHandler({
  params, returns,
  implementation: ({ id }, options) => {
    logger.debug('Options', options);
    const name = 'sample';
    if (id < 10) {
      return { status: returns.shape.status.enum.OK, name };
    }
    if (id > 100) {
      throw createHttpError(404, 'User not found');
    }
    return { status: returns.shape.status.enum.Warning, name };
  }
});
