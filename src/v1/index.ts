import {Routing} from '../routing';
import {getUserHandler} from './get-user';

export const v1Routing: Routing =  {
  getUser: getUserHandler
}
