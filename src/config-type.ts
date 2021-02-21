import {NextHandleFunction} from 'connect';

export interface ConfigType {
  server: {
    // port or socket
    listen: number | string;
    // enable cross-origin resource sharing
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    cors: boolean;
    // custom JSON parser, default: express.json()
    jsonParser?: NextHandleFunction
  },
  logger: {
    level: 'silent' | 'warn' | 'debug';
    color: boolean;
  }
}
