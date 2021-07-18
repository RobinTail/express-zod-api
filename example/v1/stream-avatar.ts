import {z} from '../../src';
import {fileStreamingEndpointsFactory} from '../factories';

export const streamAvatar = fileStreamingEndpointsFactory.build({
  methods: ['get'],
  input: z.object({
    userId: z.string().transform((str) => parseInt(str, 10))
  }),
  output: z.object({
    filename: z.string()
  }),
  handler: async () => ({ filename: 'logo.svg' })
});
