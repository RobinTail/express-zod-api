import {lookup} from 'mime';
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
  getPositiveResponse: () => createApiResponse(z.string(), lookup('svg')),
  getNegativeResponse: () => createApiResponse(z.string(), lookup('txt')),
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
  getPositiveResponse: () => createApiResponse(z.string(), 'image/*'),
  getNegativeResponse: () => createApiResponse(z.string(), lookup('txt')),
  handler: ({response, error, output}) => {
    if (error) {
      response.status(400).send(error.message);
      return;
    }
    if ('filename' in output) {
      fs.createReadStream(output.filename)
        .pipe(response.type(output.filename));
    } else {
      response.status(400).send('Filename is missing');
    }
  }
}));
