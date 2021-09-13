import {lookup} from 'mime';
import {z} from 'zod';

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  mimeTypes: string[];
};

export const createApiResponse = <S extends z.ZodTypeAny>(schema: S, mimeTypes: string | string[] = lookup('json')) => {
  return {
    schema,
    mimeTypes: typeof mimeTypes === 'string' ? [mimeTypes] : mimeTypes,
  } as ApiResponse<S>;
};
