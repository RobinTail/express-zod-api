import {lookup} from 'mime';

export const mimeJson = lookup('json');
export const mimeUpload = 'multipart/form-data';

export type MimeParam = string | string[];
