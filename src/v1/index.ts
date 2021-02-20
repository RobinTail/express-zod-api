import {Routing} from '../routing';
import {getUserEndpoint} from './get-user';

export const v1Routing: Routing =  {
  getUser: getUserEndpoint
}
