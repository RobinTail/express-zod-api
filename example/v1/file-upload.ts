import {z, defaultEndpointsFactory} from '../../src';
import crypto from 'crypto';

export const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: 'post',
  type: 'upload',
  input: z.object({
    avatar: z.upload(),
  }),
  output: z.object({
    name: z.string(),
    size: z.number().int().nonnegative(),
    mime: z.string(),
    hash: z.string()
  }),
  handler: async ({input: {avatar}}) => {
    return {
      name: avatar.name,
      size: avatar.size,
      mime: avatar.mimetype,
      hash: crypto.createHash('sha1').update(avatar.data).digest('hex')
    };
  }
});
