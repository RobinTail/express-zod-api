import {createConfig} from '../src';

export const config = createConfig({
  server: {
    listen: 8090,
  },
  cors: true,
  logger: {
    level: 'debug',
    color: true
  },
});
