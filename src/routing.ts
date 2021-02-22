import {Express} from 'express';
import {Logger} from 'winston';
import {ConfigType} from './config-type';
import {AbstractEndpoint} from './endpoint';

export interface Routing {
  [PATH: string]: AbstractEndpoint | Routing;
}

export const initRouting = ({app, logger, config, routing, parentPath}: {
  app: Express,
  logger: Logger,
  config: ConfigType,
  routing: Routing,
  parentPath?: string
}) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const handler = routing[path];
    if (handler instanceof AbstractEndpoint) {
      handler.getMethods().forEach((method) => {
        app[method](fullPath, async (request, response) => {
          logger.info(`${request.method}: ${fullPath}`);
          await handler.execute({request, response, logger, config});
        });
      });
    } else {
      initRouting({
        app, logger, config,
        routing: handler,
        parentPath: fullPath
      });
    }
  });
};
