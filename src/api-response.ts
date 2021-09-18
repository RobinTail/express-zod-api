import {z} from 'zod';
import {mimeJson, MimeDefinition} from './mime';

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  mimeTypes: string[];
};

export const createApiResponse = <S extends z.ZodTypeAny>(schema: S, mimeTypes: MimeDefinition = mimeJson) => {
  return {
    schema,
    mimeTypes: typeof mimeTypes === 'string' ? [mimeTypes] : mimeTypes,
  } as ApiResponse<S>;
};
