import {z} from 'zod';
import {mimeJson, MimeParam} from './mime';

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  mimeTypes: string[];
};

export const createApiResponse = <S extends z.ZodTypeAny>(schema: S, mimeTypes: MimeParam = mimeJson) => {
  return {
    schema,
    mimeTypes: typeof mimeTypes === 'string' ? [mimeTypes] : mimeTypes,
  } as ApiResponse<S>;
};
