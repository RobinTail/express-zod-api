import {ConfigType} from '../src/config-type';
import {Routing} from '../src/routing';
import {createServer} from '../src/server';
import {v1Routing} from './v1';

export const config: ConfigType = {
  server: {
    listen: 8090,
  },
  logger: {
    level: 'debug',
    color: true
  }
};

export const routing: Routing = {
  v1: v1Routing
}

createServer(config, routing);
