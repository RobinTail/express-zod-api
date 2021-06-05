import {DependsOnMethod, Routing} from '../../src';
import {getUserEndpoint} from './get-user';
import {setUserEndpoint} from './set-user';

export const v1Routing: Routing = {
  // syntax 1: methods are defined within the endpoint
  getUser: getUserEndpoint,

  // syntax 2: methods are defined within the route
  setUser: new DependsOnMethod({
    post: setUserEndpoint // the Endpoint should have at least the same method specified in .build()
  })
};
