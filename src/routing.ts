import {Express} from 'express';
import {Logger} from 'winston';
import {CommonConfig} from './config-type';
import {AbstractEndpoint, Endpoint} from './endpoint';
import {DependsOnMethodError, RoutingError} from './errors';
import {AuxMethod, Method} from './method';

export class DependsOnMethod {
  constructor(public readonly methods: {
    [K in Method]?: Endpoint<any, any, any, any, K, any, any> | Endpoint<any, any, any, any, Method, any, any>;
  }) {
    (Object.keys(methods) as (keyof typeof methods)[]).forEach((key) => {
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

export interface RoutingCycleParams {
  routing: Routing;
  cb: (endpoint: AbstractEndpoint, fullPath: string, method: Method | AuxMethod) => void;
  parentPath?: string;
  cors?: boolean;
}

export const routingCycle = ({routing, cb, parentPath, cors}: RoutingCycleParams) => {
  Object.entries(routing).forEach(([path, element]) => {
    path = path.trim();
    if (path.match(/\//)) {
      throw new RoutingError(
        'Routing elements should not contain \'/\' character.\n' + 
        `The error caused by ${parentPath ? `'${parentPath}' route that has a '${path}'` : `'${path}'`} entry.`
      );
    }
    const fullPath = `${parentPath || ''}${path ? `/${path}` : ''}`;
    if (element instanceof AbstractEndpoint) {
      const methods: (Method | AuxMethod)[] = element.getMethods();
      if (cors) {
        methods.push('options');
      }
      methods.forEach((method) => {
        cb(element, fullPath, method);
      });
    } else if (element instanceof DependsOnMethod) {
      Object.entries<AbstractEndpoint>(element.methods).forEach(([method, endpoint]) => {
        cb(endpoint, fullPath, method as Method);
      });
      if (cors && Object.keys(element.methods).length > 0) {
        const firstEndpoint = Object.values(element.methods)[0] as AbstractEndpoint;
        cb(firstEndpoint, fullPath, 'options');
      }
    } else {
      routingCycle({
        routing: element,
        cb, cors,
        parentPath: fullPath
      });
    }
  });
};

export const initRouting = ({app, logger, config, routing}: {
  app: Express,
  logger: Logger,
  config: CommonConfig,
  routing: Routing
}) => {
  routingCycle({
    routing,
    cors: config.cors,
    cb: (endpoint, fullPath, method) => {
      app[method](fullPath, async (request, response) => {
        logger.info(`${request.method}: ${fullPath}`);
        await endpoint.execute({request, response, logger, config});
      });
    }
  });
};
