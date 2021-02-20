import {Express} from 'express';
import {AbstractEndpoint} from './endpoint';
import {logger} from './logger';
import {v1Routing} from './v1';

export interface Routing {
  [PATH: string]: AbstractEndpoint | Routing;
}

export const routing: Routing = {
  v1: v1Routing
}

export const initRouting = (app: Express, routing: Routing, parentPath?: string) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const handler = routing[path];
    if (handler instanceof AbstractEndpoint) {
      app.post(fullPath, async (req, res) => {
        logger.info(`${req.method}: ${fullPath}`);
        await handler.execute(req, res);
      });
    } else {
      initRouting(app, handler, fullPath);
    }
  });
}
