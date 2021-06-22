import {EndpointsFactory} from '../src';
import {defaultResultHandler} from '../src/result-handler';
import {authMiddleware} from './middlewares';

export const endpointsFactory = new EndpointsFactory(defaultResultHandler);

export const keyAndTokenAuthenticatedEndpointsFactory = endpointsFactory.addMiddleware(authMiddleware);
