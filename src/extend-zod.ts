import {ZodFile} from './file-schema';
import {ZodUpload} from './upload-schema';

export * from 'zod';
export const file = ZodFile.create;
export const upload = ZodUpload.create;
