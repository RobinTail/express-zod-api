import express from 'express';
import fileUpload from 'express-fileupload';
import {Server} from 'http';
import {AppConfig, CommonConfig, ServerConfig} from './config-type';
import {isLoggerConfig} from './helpers';
import {createLogger} from './logger';
import {defaultResultHandler} from './result-handler';
import {initRouting, Routing} from './routing';
import createHttpError from 'http-errors';

export function attachRouting(config: AppConfig & CommonConfig, routing: Routing): void {
  const logger = isLoggerConfig(config.logger) ? createLogger(config.logger) : config.logger;
  return initRouting({app: config.app, routing, logger, config});
}

export function createServer(config: ServerConfig & CommonConfig, routing: Routing): Server {
  const logger = isLoggerConfig(config.logger) ? createLogger(config.logger) : config.logger;
  const app = express();
  const errorHandler = config.errorHandler || defaultResultHandler;
  const jsonParser = config.server.jsonParser || express.json();
  const multipartParser = fileUpload(); // @todo options

  const parserFailureHandler: express.ErrorRequestHandler = (error, request, response, next) => {
    if (!error) { return next(); }
    errorHandler.handler({
      error, request, response, logger,
      input: request.body,
      output: null
    });
  };

  const lastResortHandler: express.RequestHandler = (request, response) => {
    errorHandler.handler({
      request, response, logger,
      error: createHttpError(404, `Can not ${request.method} ${request.path}`),
      input: null,
      output: null
    });
  };

  app.use([jsonParser, multipartParser, parserFailureHandler]); // @todo multipart optional
  initRouting({app, routing, logger, config});
  app.use(lastResortHandler);

  return app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
}
