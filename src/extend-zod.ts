import {ZodFile} from './file-schema';

export * from 'zod';
export const file = ZodFile.create;
