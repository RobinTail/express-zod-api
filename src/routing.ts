import { IRouter } from "express";
import { CommonConfig } from "./config-type";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger } from "./logger";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { getStartupLogo } from "./startup-logo";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export const initRouting = ({
  app,
  logger,
  config,
  routing,
}: {
  app: IRouter;
  logger: AbstractLogger;
  config: CommonConfig;
  routing: Routing;
}) => {
  if (config.startupLogo !== false) {
    console.log(getStartupLogo());
  }
  logger.debug("Running", process.env.TSUP_BUILD || "from sources");
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
