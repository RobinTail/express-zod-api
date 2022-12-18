import { Express } from "express";
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

export interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: (
    endpoint: AbstractEndpoint,
    path: string,
    method: Method | AuxMethod
  ) => void;
  onStatic?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
  hasCors?: boolean;
}

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
  parentPath,
  hasCors,
}: RoutingWalkerParams) => {
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
        onEndpoint(element, path, method);
      });
    } else if (element instanceof ServeStatic) {
      if (onStatic) {
        element.apply(path, onStatic);
      }
    } else if (element instanceof DependsOnMethod) {
      Object.entries<AbstractEndpoint>(element.methods).forEach(
        ([method, endpoint]) => {
          onEndpoint(endpoint, path, method as Method);
        }
      );
      if (hasCors && Object.keys(element.methods).length > 0) {
        const [firstMethod, ...siblingMethods] = Object.keys(
          element.methods
        ) as Method[];
        const firstEndpoint = element.methods[firstMethod]!;
        firstEndpoint._setSiblingMethods(siblingMethods);
        onEndpoint(firstEndpoint, path, "options");
      }
    } else {
      walkRouting({
        onEndpoint,
        onStatic,
        hasCors,
        routing: element,
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
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method) => {
      app[method](path, async (request, response) => {
        logger.info(`${request.method}: ${path}`);
        await endpoint.execute({ request, response, logger, config });
      });
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
};
