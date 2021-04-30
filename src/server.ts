import * as express from 'express';
import {Server} from 'http';
import {ConfigType} from './config-type';
import {isLoggerConfig} from './helpers';
import {createLogger} from './logger';
import {defaultResultHandler} from './result-handler';
import {initRouting, Routing} from './routing';
import * as createHttpError from 'http-errors';

type ConfigWithServer = Exclude<ConfigType, {app: any}>;
type ConfigWithApp = Exclude<ConfigType, {server: any}>;

export function createServer(config: ConfigWithServer, routing: Routing): Server;
export function createServer(config: ConfigWithApp, routing: Routing): void;
export function createServer(config: ConfigType, routing: Routing): Server | void {
  const logger = isLoggerConfig(config.logger) ? createLogger(config.logger) : config.logger;

  if ('app' in config) {
    return initRouting({app: config.app, routing, logger, config});
  }

  const app = express();
  const resultHandler = config.resultHandler || defaultResultHandler;

  app.use([
    config.server.jsonParser || express.json(),
    (error, request, response, next) => {
      if (error) {
        resultHandler({
          error, request, response, logger,
          input: request.body,
          output: null
        });
      } else {
        next();
      }
    }
  ]);

  initRouting({app, routing, logger, config});

  app.use((request, response) => {
    resultHandler({
      request, response, logger,
      error: createHttpError(404, `Can not ${request.method} ${request.path}`),
      input: null,
      output: null
    });
  });

  return app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
}
