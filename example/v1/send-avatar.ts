import { z } from '../../src';
import {fileDownloadEndpointsFactory} from '../factories';
import fs from 'fs';

export const sendAvatar = fileDownloadEndpointsFactory.build({
  methods: ['get'],
  input: z.object({
    userId: z.string().transform((str) => parseInt(str, 10))
  }),
  output: z.object({
    data: z.string()
  }),
  handler: async () => {
    const data = fs.readFileSync('logo.svg', 'utf-8');
    return { data };
  }
});
