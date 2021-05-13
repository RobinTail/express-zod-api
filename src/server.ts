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

export function attachRouting(config: ConfigWithApp, routing: Routing): void {
  const logger = isLoggerConfig(config.logger) ? createLogger(config.logger) : config.logger;
  return initRouting({app: config.app, routing, logger, config});
}

export function createServer(config: ConfigWithServer, routing: Routing): Server {
  const logger = isLoggerConfig(config.logger) ? createLogger(config.logger) : config.logger;
  const app = express();
  const resultHandler = config.resultHandler || defaultResultHandler;
  const jsonParser = config.server.jsonParser || express.json();

  const jsonFailureHandler: express.ErrorRequestHandler = (error, request, response, next) => {
    if (!error) { return next(); }
    return resultHandler({
      error, request, response, logger,
      input: request.body,
      output: null
    });
  };

  const lastResortHandler: express.RequestHandler = (request, response) => {
    resultHandler({
      request, response, logger,
      error: createHttpError(404, `Can not ${request.method} ${request.path}`),
      input: null,
      output: null
    });
  };

  app.use([jsonParser, jsonFailureHandler]);
  initRouting({app, routing, logger, config});
  app.use(lastResortHandler);

  return app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
}
