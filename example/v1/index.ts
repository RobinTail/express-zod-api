import {DependsOnMethod, Routing} from '../../src';
import {fileUploadEndpoint} from './file-upload';
import {getUserEndpoint} from './get-user';
import {sendAvatarEndpoint} from './send-avatar';
import {setUserEndpoint} from './set-user';
import {streamAvatarEndpoint} from './stream-avatar';

export const v1Routing: Routing = {
  // syntax 1: methods are defined within the endpoint
  getUser: getUserEndpoint,

  // syntax 2: methods are defined within the route
  setUser: new DependsOnMethod({
    post: setUserEndpoint // the Endpoint should have at least the same method specified in .build()
  }),

  // custom result handler examples with a file serving
  avatar: sendAvatarEndpoint,
  stream: streamAvatarEndpoint,

  // file upload
  upload: fileUploadEndpoint,
};
