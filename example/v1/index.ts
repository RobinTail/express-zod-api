import {Routing} from '../../src/routing';
import {getUserEndpoint} from './get-user';
import {setUserEndpoint} from './set-user';

export const v1Routing: Routing =  {
  getUser: getUserEndpoint,
  setUser: setUserEndpoint
}
