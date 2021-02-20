import {Express} from 'express';
import {Logger} from 'winston';
import {AbstractEndpoint} from './endpoint';

export interface Routing {
  [PATH: string]: AbstractEndpoint | Routing;
}

export const initRouting = ({app, logger, routing, parentPath}: {
  app: Express,
  logger: Logger,
  routing: Routing,
  parentPath?: string
}) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const handler = routing[path];
    if (handler instanceof AbstractEndpoint) {
      handler.getMethods().forEach((method) => {
        app[method](fullPath, async (req, res) => {
          logger.info(`${req.method}: ${fullPath}`);
          await handler.execute(req, res, logger);
        });
      });
    } else {
      initRouting({
        app, logger,
        routing: handler,
        parentPath: fullPath
      });
    }
  });
}
