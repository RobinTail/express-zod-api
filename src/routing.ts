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
    const endpoint = routing[path];
    if (endpoint instanceof AbstractEndpoint) {
      endpoint.getMethods().forEach((method) => {
        app[method](fullPath, async (request, response) => {
          logger.info(`${request.method}: ${fullPath}`);
          await endpoint.execute({request, response, logger, config});
        });
      });
    } else {
      initRouting({
        app, logger, config,
        routing: endpoint,
        parentPath: fullPath
      });
    }
  });
};
