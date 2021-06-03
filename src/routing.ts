import {Express} from 'express';
import {Logger} from 'winston';
import {ConfigType} from './config-type';
import {AbstractEndpoint} from './endpoint';
import {Method, RouteMethods} from './method';

export interface Routing {
  [PATH: string]: Routing | RouteMethods | AbstractEndpoint<any>;
}

type RoutingCycleCallback = (endpoint: AbstractEndpoint<any>, fullPath: string, method: Method) => void;

export const routingCycle = (routing: Routing, cb: RoutingCycleCallback, parentPath?: string) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const element = routing[path];
    if (element instanceof AbstractEndpoint) {
      element.getMethods().forEach((method) => {
        cb(element, fullPath, method);
      });
    } else if (element instanceof RouteMethods) {
      Object.entries<AbstractEndpoint<any>>(element.methods).forEach(([method, endpoint]) => {
        cb(endpoint, fullPath, method as Method);
      });
    } else {
      routingCycle(element, cb, fullPath);
    }
  });
};

export const initRouting = ({app, logger, config, routing}: {
  app: Express,
  logger: Logger,
  config: ConfigType,
  routing: Routing
}) => {
  routingCycle(routing, (endpoint, fullPath, method) => {
    app[method](fullPath, async (request, response) => {
      logger.info(`${request.method}: ${fullPath}`);
      await endpoint.execute({request, response, logger, config});
    });
  });
};
