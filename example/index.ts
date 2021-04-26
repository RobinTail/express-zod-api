import {ConfigType} from '../src';
import {createServer} from '../src';
import {routing} from './routing';

const config: ConfigType = {
  server: {
    listen: 8090,
  },
  cors: true,
  logger: {
    level: 'debug',
    color: true
  }
};

createServer(config, routing);
