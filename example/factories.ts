import {getType} from 'mime';
import {
  createApiResponse,
  createResultHandler,
  defaultEndpointsFactory,
  EndpointsFactory,
  z
} from '../src';
import {authMiddleware} from './middlewares';
import fs from 'fs';

export const keyAndTokenAuthenticatedEndpointsFactory = defaultEndpointsFactory.addMiddleware(authMiddleware);

export const fileDownloadEndpointsFactory = new EndpointsFactory(createResultHandler({
  getPositiveResponse: () => createApiResponse(z.string(), getType('svg') || 'image/svg+xml'),
  getNegativeResponse: () => createApiResponse(z.string(), getType('txt') || 'text/plain'),
  handler: ({response, error, output}) => {
    if (error) {
      response.status(400).send(error.message);
      return;
    }
    if ('data' in output) {
      response.type('svg').send(output.data);
    } else {
      response.status(400).send('Data is missing');
    }
  }
}));

export const fileStreamingEndpointsFactory = new EndpointsFactory(createResultHandler({
  getPositiveResponse: () => createApiResponse(z.file().binary(), 'image/*'),
  getNegativeResponse: () => createApiResponse(z.string(), getType('txt') || 'text/plain'),
  handler: async ({response, error, output}) => {
    if (error) {
      response.status(400).send(error.message);
      return;
    }
    if ('filename' in output) {
      // @todo update readme and put in the changelog
      await new Promise((resolve, reject) =>
        fs.createReadStream(output.filename)
          .pipe(response.type(output.filename))
          .on('close', resolve)
          .on('error', reject)
      );
    } else {
      response.status(400).send('Filename is missing');
    }
  }
}));
