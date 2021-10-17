import {DependsOnMethod, Routing} from '../src';
import {fileUploadEndpoint} from './endpoints/file-upload';
import {getUserEndpoint} from './endpoints/get-user';
import {sendAvatarEndpoint} from './endpoints/send-avatar';
import {setUserEndpoint} from './endpoints/set-user';
import {streamAvatarEndpoint} from './endpoints/stream-avatar';

export const routing: Routing = {
  v1: {
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
  }
};
