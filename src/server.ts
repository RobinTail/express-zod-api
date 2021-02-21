import * as express from 'express';
import {ConfigType} from './config-type';
import {createLogger} from './logger';
import {defaultResultHandler} from './result-handler';
import {initRouting, Routing} from './routing';
import * as createHttpError from 'http-errors';

export function createServer(config: ConfigType, routing: Routing) {
  const logger = createLogger(config);
  const app = express();
  const resultHandler = config.server.errorsHandler || defaultResultHandler;

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
    })
  });

  return app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
}
