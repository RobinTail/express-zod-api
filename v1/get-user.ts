import * as z from 'zod';
import {createHandler} from '../handler';
import {logger} from '../logger';

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
    return { status: returns.shape.status.enum.Warning, name };
  }
});
