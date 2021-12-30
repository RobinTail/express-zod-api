import { Express, static as _serveStatic } from "express";
import { Logger } from "winston";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint, Endpoint } from "./endpoint";
import { DependsOnMethodError, RoutingError } from "./errors";
import { AuxMethod, Method } from "./method";
import { getStartupLogo } from "./startup-logo";

export type StaticHandler = ReturnType<typeof _serveStatic> & {
  _typeGuard: "StaticHandler";
};

export const serveStatic = (...params: Parameters<typeof _serveStatic>) =>
  _serveStatic(...params) as StaticHandler;

export class DependsOnMethod {
  constructor(
    public readonly methods: {
      [K in Method]?:
        | Endpoint<any, any, any, any, K, any, any>
        | Endpoint<any, any, any, any, Method, any, any>;
    }
  ) {
    (Object.keys(methods) as (keyof typeof methods)[]).forEach((key) => {
      if (key in methods) {
        const endpointMethods = methods[key]?.getMethods() || [];
        if (!endpointMethods.includes(key)) {
          throw new DependsOnMethodError(
            `The endpoint assigned to the '${key}' parameter must have at least this method in its specification.\n` +
              "This error should prevent mistakes during the development process.\n" +
              "Example:\n\n" +
              `new ${this.constructor.name}({\n` +
              `  ${key}: endpointsFactory.build({\n` +
              `    methods: ['${key}', ` +
              ((methods[key]?.getMethods() || [])
                .map((m) => `'${m}'`)
                .join(", ") || "...") +
              "]\n" +
              `    // or method: '${key}'\n` +
              "    ...\n" +
              "  })\n" +
              "});\n"
          );
        }
      }
    });
  }
}

export interface Routing {
  [SEGMENT: string]:
    | Routing
    | DependsOnMethod
    | AbstractEndpoint
    | StaticHandler;
}

export interface RoutingCycleParams {
  routing: Routing;
  endpointCb: (
    endpoint: AbstractEndpoint,
    path: string,
    method: Method | AuxMethod
  ) => void;
  staticCb?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
  cors?: boolean;
}

export const routingCycle = ({
  routing,
  endpointCb,
  staticCb,
  parentPath,
  cors,
}: RoutingCycleParams) => {
  Object.entries(routing).forEach(([segment, element]) => {
    segment = segment.trim();
    if (segment.match(/\//)) {
      throw new RoutingError(
        "Routing elements should not contain '/' character.\n" +
          `The error caused by ${
            parentPath
              ? `'${parentPath}' route that has a '${segment}'`
              : `'${segment}'`
          } entry.`
      );
    }
    const path = `${parentPath || ""}${segment ? `/${segment}` : ""}`;
    if (element instanceof AbstractEndpoint) {
      const methods: (Method | AuxMethod)[] = element.getMethods().slice();
      if (cors) {
        methods.push("options");
      }
      methods.forEach((method) => {
        endpointCb(element, path, method);
      });
    } else if (typeof element === "function") {
      if (staticCb) {
        staticCb(path, element);
      }
    } else if (element instanceof DependsOnMethod) {
      Object.entries<AbstractEndpoint>(element.methods).forEach(
        ([method, endpoint]) => {
          endpointCb(endpoint, path, method as Method);
        }
      );
      if (cors && Object.keys(element.methods).length > 0) {
        const firstEndpoint = Object.values(
          element.methods
        )[0] as AbstractEndpoint;
        endpointCb(firstEndpoint, path, "options");
      }
    } else {
      routingCycle({
        routing: element,
        endpointCb,
        staticCb,
        cors,
        parentPath: path,
      });
    }
  });
};

export const initRouting = ({
  app,
  logger,
  config,
  routing,
}: {
  app: Express;
  logger: Logger;
  config: CommonConfig;
  routing: Routing;
}) => {
  if (config.startupLogo !== false) {
    console.log(getStartupLogo());
  }
  routingCycle({
    routing,
    cors: config.cors,
    endpointCb: (endpoint, path, method) => {
      app[method](path, async (request, response) => {
        logger.info(`${request.method}: ${path}`);
        await endpoint.execute({ request, response, logger, config });
      });
    },
    staticCb: (path, handler) => {
      app.use(path, handler);
    },
  });
};
