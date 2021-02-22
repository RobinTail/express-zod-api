import {ConfigType} from '../src';
import {Routing} from '../src';
import {createServer} from '../src';
import {v1Routing} from './v1';

const config: ConfigType = {
  server: {
    listen: 8090,
    cors: true
  },
  logger: {
    level: 'debug',
    color: true
  }
};

const routing: Routing = {
  v1: v1Routing
};

createServer(config, routing);
