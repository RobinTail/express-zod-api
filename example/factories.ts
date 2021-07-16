import {lookup} from 'mime';
import {
  createApiResponse,
  createResultHandler,
  defaultEndpointsFactory,
  EndpointsFactory,
  z
} from '../src';
import {authMiddleware} from './middlewares';

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
      // Another approach is the endpoint that outputs filename and ResultHandler calls response.sendFile().
    } else {
      response.status(400).send('Data is missing');
    }
  }
}));
