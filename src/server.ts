import * as express from 'express';
import {Server} from 'http';
import * as winston from 'winston';
import {ConfigType, LoggerConfig, ServerConfig} from './config-type';
import {isLoggerConfig} from './helpers';
import {createLogger} from './logger';
import {defaultResultHandler} from './result-handler';
import {initRouting, Routing} from './routing';
import * as createHttpError from 'http-errors';

function getLoggerFromConfig(logger: LoggerConfig | winston.Logger) {
  return isLoggerConfig(logger) ? createLogger(logger) : logger;
}

export function attachToApp(config: ConfigType<express.Express>, routing: Routing): void {
  const logger = getLoggerFromConfig(config.logger);
  return initRouting({app: config.server, routing, logger, config});
}

export function createServer(config: ConfigType<ServerConfig>, routing: Routing): Server {
  const logger = getLoggerFromConfig(config.logger);
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
