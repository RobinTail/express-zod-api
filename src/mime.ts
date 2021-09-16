import {getType} from 'mime';

export const mimeJson = getType('json') || 'application/json';
export const mimeUpload = 'multipart/form-data';

export type MimeParam = string | string[];
