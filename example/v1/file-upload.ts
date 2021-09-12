import { z } from '../../src';
import {fileUploadEndpointsFactory} from '../factories';
import crypto from 'crypto';

const fileDescriptionsSchema = z.record(z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  mime: z.string(),
  hash: z.string()
}));

// @todo content type of input (?)
export const fileUploadEndpoint = fileUploadEndpointsFactory.build({
  method: 'post',
  input: z.object({}),
  output: z.object({
    files: fileDescriptionsSchema
  }),
  handler: async ({options}) => {
    const fileDescriptions = Object.entries(options.files)
      .map(([key, file]) => ({
        key,
        file: Array.isArray(file) ? file[0] : file
      }))
      .reduce((carry, {key, file}) => ({
        ...carry,
        [key]: {
          name: file.name,
          size: file.size,
          mime: file.mimetype,
          hash: crypto.createHash('sha1').update(file.data).digest('hex')
        }
      }), {} as z.input<typeof fileDescriptionsSchema>);
    return { files: fileDescriptions };
  }
});
