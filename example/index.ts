import {ConfigType, ServerConfig} from '../src';
import {createServer} from '../src';
import {routing} from './routing';

const config: ConfigType<ServerConfig> = {
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
