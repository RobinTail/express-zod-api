import {NextHandleFunction} from 'connect';
import {ResultHandler} from './result-handler';

export interface ConfigType {
  server: {
    // port or socket
    listen: number | string;
    // enable cross-origin resource sharing
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    cors: boolean;
    // custom JSON parser, default: express.json()
    jsonParser?: NextHandleFunction,
    // custom handler for errors and output, default: defaultResultHandler()
    resultHandler?: ResultHandler;
  },
  logger: {
    level: 'silent' | 'warn' | 'debug';
    color: boolean;
  }
}
