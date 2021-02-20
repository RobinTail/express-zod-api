import * as express from 'express';
import {defaultResultHandler} from './result-handler';
import {initRouting, routing} from './routing';
import * as createHttpError from 'http-errors';

const app = express();
app.use([
  express.json(),
  (error, request, response, next) => {
    if (error) {
      defaultResultHandler({
        error, request, response,
        input: request.body,
        output: null
      });
    } else {
      next();
    }
  }
]);

initRouting(app, routing);

app.use((request, response) => {
  defaultResultHandler({
    request, response,
    error: createHttpError(404, `Can not ${request.method} ${request.path}`),
    input: null,
    output: null
  })
});

app.listen(8090, () => {
  console.log('Listening...');
});
