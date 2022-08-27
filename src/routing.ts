import express from "express";
import { Logger } from "winston";
import { CommonConfig } from "./config-type";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { AuxMethod, Method } from "./method";
import { ServeStatic, StaticHandler } from "./serve-static";
import { getStartupLogo } from "./startup-logo";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
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
  hasCors?: boolean;
}

export const routingCycle = ({
  routing,
  endpointCb,
  staticCb,
  parentPath,
  hasCors,
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
      if (hasCors) {
        methods.push("options");
      }
      methods.forEach((method) => {
        endpointCb(element, path, method);
      });
    } else if (element instanceof ServeStatic) {
      if (staticCb) {
        staticCb(path, express.static(...element.params));
      }
    } else if (element instanceof DependsOnMethod) {
      Object.entries<AbstractEndpoint>(element.methods).forEach(
        ([method, endpoint]) => {
          endpointCb(endpoint, path, method as Method);
        }
      );
      if (hasCors && Object.keys(element.methods).length > 0) {
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
        hasCors: hasCors,
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
  app: express.Express;
  logger: Logger;
  config: CommonConfig;
  routing: Routing;
}) => {
  if (config.startupLogo !== false) {
    console.log(getStartupLogo());
  }
  routingCycle({
    routing,
    hasCors: !!config.cors,
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
