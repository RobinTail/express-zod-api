import {createConfig, createServer} from '../src';
import {routing} from './routing';

const config = createConfig({
  server: {
    listen: 8090,
  },
  cors: true,
  logger: {
    level: 'debug',
    color: true
  }
});

createServer(config, routing);
