import {z, defaultEndpointsFactory} from '../../src';
import crypto from 'crypto';

export const fileUploadEndpoint = defaultEndpointsFactory.build({
  method: 'post',
  type: 'upload',
  input: z.object({
    avatar: z.upload().refine(
      (file) => file.mimetype.match(/image\/.+/),
      'Should be an image'
    ),
  }).passthrough(),
  output: z.object({
    name: z.string(),
    size: z.number().int().nonnegative(),
    mime: z.string(),
    hash: z.string(),
    otherInputs: z.record(z.any()),
  }),
  handler: async ({input: {avatar, ...rest}}) => {
    return {
      name: avatar.name,
      size: avatar.size,
      mime: avatar.mimetype,
      hash: crypto.createHash('sha1').update(avatar.data).digest('hex'),
      otherInputs: rest,
    };
  }
});
