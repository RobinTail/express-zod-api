import {lookup} from 'mime';

export const mimeJson = lookup('json');
export type MimeProp = string | string[];
