import { DependsOnMethod, Routing, ServeStatic } from "express-zod-api";
import { rawAcceptingEndpoint } from "./endpoints/accept-raw";
import { createUserEndpoint } from "./endpoints/create-user";
import { deleteUserEndpoint } from "./endpoints/delete-user";
import { listUsersEndpoint } from "./endpoints/list-users";
import { subscriptionEndpoint } from "./endpoints/time-subscription";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user";
import { sendAvatarEndpoint } from "./endpoints/send-avatar";
import { updateUserEndpoint } from "./endpoints/update-user";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar";
import { join } from "node:path";

export const routing: Routing = {
  v1: {
    user: {
      // syntax 1: methods are defined within the endpoint
      retrieve: retrieveUserEndpoint, // path: /v1/user/retrieve
      // syntax 2: methods are defined within the route (id is the route path param by the way)
      ":id": new DependsOnMethod({
        patch: updateUserEndpoint, // demonstrates authentication
      }).nest({
        remove: deleteUserEndpoint, // nested path: /v1/user/:id/remove
      }),
      // demonstrates different response schemas depending on status code
      create: createUserEndpoint,
      // this one demonstrates the legacy array based response
      list: listUsersEndpoint,
    },
    avatar: {
      // custom result handler examples with a file serving
      send: sendAvatarEndpoint,
      stream: streamAvatarEndpoint,
      // file upload example
      upload: uploadAvatarEndpoint,
      // raw body acceptance example
      raw: rawAcceptingEndpoint,
    },
    events: {
      stream: subscriptionEndpoint,
    },
  },
  // path /public serves static files from /example/assets
  public: new ServeStatic(join("example", "assets"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};
