import {defaultEndpointsFactory} from '../src';
import {authMiddleware} from './middlewares';

export const keyAndTokenAuthenticatedEndpointsFactory = defaultEndpointsFactory.addMiddleware(authMiddleware);
