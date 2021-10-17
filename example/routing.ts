import {DependsOnMethod, Routing} from '../src';
import {fileUploadEndpoint} from './endpoints/file-upload';
import {getUserEndpoint} from './endpoints/get-user';
import {sendAvatarEndpoint} from './endpoints/send-avatar';
import {setUserEndpoint} from './endpoints/set-user';
import {streamAvatarEndpoint} from './endpoints/stream-avatar';

export const routing: Routing = {
  // syntax 1: methods are defined within the endpoint
  v1: {
    user: {
      retrieve: getUserEndpoint, // path: /v1/user/retrieve
    },

    // custom result handler examples with a file serving
    avatar: {
      send: sendAvatarEndpoint,
      stream: streamAvatarEndpoint,
      upload: fileUploadEndpoint, // file upload example
    },
  },

  // syntax 2: methods are defined within the route
  v2: {
    user: new DependsOnMethod({
      post: setUserEndpoint // the Endpoint should have at least the same method specified in .build()
    }),
  }
};
