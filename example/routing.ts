import { DependsOnMethod, Routing } from "../src";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user";
import { sendAvatarEndpoint } from "./endpoints/send-avatar";
import { updateUserEndpoint } from "./endpoints/update-user";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar";

export const routing: Routing = {
  // syntax 1: methods are defined within the endpoint
  v1: {
    user: {
      retrieve: retrieveUserEndpoint, // path: /v1/user/retrieve
    },
    avatar: {
      // custom result handler examples with a file serving
      send: sendAvatarEndpoint,
      stream: streamAvatarEndpoint,
      // file upload example
      upload: uploadAvatarEndpoint,
    },
  },

  // syntax 2: methods are defined within the route
  v2: {
    user: new DependsOnMethod({
      // withMeta().example() example here:
      post: updateUserEndpoint, // the Endpoint should have at least the same method specified in .build()
    }),
  },
};
