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

export const initRouting = async ({
  app,
  rootLogger,
  config,
  routing,
}: {
  app: IRouter;
  rootLogger: AbstractLogger;
  config: CommonConfig;
  routing: Routing;
}) => {
  if (config.startupLogo !== false) {
    console.log(await getStartupLogo());
  }
  rootLogger.debug("Running", process.env.TSUP_BUILD || "from sources");
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      app[method](path, async (request, response) => {
        const logger = config.childLoggerProvider
          ? await config.childLoggerProvider({ request, parent: rootLogger })
          : rootLogger;
        logger.info(`${request.method}: ${path}`);
        await endpoint.execute({
          request,
          response,
          logger,
          config,
          siblingMethods,
        });
      });
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
};
