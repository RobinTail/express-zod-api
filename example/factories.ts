import {EndpointsFactory} from '../src';
import {defaultResultHandler} from '../src/result-handler';
import {authMiddleware} from './middlewares';

export const endpointsFactory = new EndpointsFactory().setResultHandler(defaultResultHandler);

export const keyAndTokenAuthenticatedEndpointsFactory = endpointsFactory.addMiddleware(authMiddleware);
