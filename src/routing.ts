import {Express} from 'express';
import {Logger} from 'winston';
import {ConfigType} from './config-type';
import {AbstractEndpoint, Endpoint} from './endpoint';
import {DependsOnMethodError} from './errors';
import {Method} from './method';

export class DependsOnMethod {
  constructor(public readonly methods: {
    [K in Method]?: Endpoint<any, any, any, any, K> | Endpoint<any, any, any, any, Method>;
  }) {
    Object.keys(methods).forEach((key: keyof typeof methods) => {
      if (key in methods) {
        const endpointMethods = methods[key]?.getMethods() || [];
        if (!endpointMethods.includes(key)) {
          throw new DependsOnMethodError(
            `The endpoint assigned to the '${key}' parameter must have at least this method in its specification.\n` +
            'This error should prevent mistakes during the development process.\n' +
            'Example:\n\n' +
            `new ${this.constructor.name}({\n` +
            `  ${key}: endpointsFactory.build({\n` +
            `    methods: ['${key}', ` + (
              (methods[key]?.getMethods() || [])
                .map((m) => `'${m}'`)
                .join(', ')
              || '...'
            ) + ']\n' +
            `    // or method: '${key}'\n` +
            '    ...\n' +
            '  })\n' +
            '});\n'
          );
        }
      }
    });
  }
}

export interface Routing {
  [PATH: string]: Routing | DependsOnMethod | AbstractEndpoint;
}

type RoutingCycleCallback = (endpoint: AbstractEndpoint, fullPath: string, method: Method) => void;

export const routingCycle = (routing: Routing, cb: RoutingCycleCallback, parentPath?: string) => {
  Object.keys(routing).forEach((path) => {
    const fullPath = `${parentPath || ''}/${path}`;
    const element = routing[path];
    if (element instanceof AbstractEndpoint) {
      element.getMethods().forEach((method) => {
        cb(element, fullPath, method);
      });
    } else if (element instanceof DependsOnMethod) {
      Object.entries<AbstractEndpoint>(element.methods).forEach(([method, endpoint]) => {
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
