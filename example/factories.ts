import {EndpointsFactory} from '../src';
import {authMiddleware} from './middlewares';

export const endpointsFactory = new EndpointsFactory();

export const keyAndTokenAuthenticatedEndpointsFactory = endpointsFactory.addMiddleware(authMiddleware);
