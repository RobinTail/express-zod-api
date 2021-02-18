import {Express} from 'express';
import {Handler, tryHandler} from './handler';
import {logger} from './logger';
import {v1Routing} from './v1';

export interface Routing {
  [PATH: string]: Handler | Routing;
}

export const routing: Routing = {
  v1: v1Routing
}

export const initRouting = (app: Express, routing: Routing, parentPath?: string) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const handler = routing[path];
    if (typeof handler === 'function') {
      app.post(fullPath, (req, res) => {
        logger.info(`${req.method}: ${fullPath}`);
        tryHandler({req, res, handler});
      });
    } else {
      initRouting(app, handler, fullPath);
    }
  });
}
