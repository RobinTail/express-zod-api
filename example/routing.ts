import path from "node:path";
import { DependsOnMethod, Routing, ServeStatic } from "../src/index.js";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar.js";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user.js";
import { sendAvatarEndpoint } from "./endpoints/send-avatar.js";
import { updateUserEndpoint } from "./endpoints/update-user.js";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar.js";

export const routing: Routing = {
  v1: {
    user: {
      // syntax 1: methods are defined within the endpoint
      retrieve: retrieveUserEndpoint, // path: /v1/user/retrieve
      // syntax 2: methods are defined within the route (id is the route path param by the way)
      ":id": new DependsOnMethod({
        post: updateUserEndpoint, // the Endpoint should have at least the same method specified in .build()
      }),
    },
    avatar: {
      // custom result handler examples with a file serving
      send: sendAvatarEndpoint,
      stream: streamAvatarEndpoint,
      // file upload example
      upload: uploadAvatarEndpoint,
    },
  },
  // path /public serves static files from /example/assets
  public: new ServeStatic(path.join(process.cwd(), "example", "assets"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};
