import { DependsOnMethod, type Routing, ServeStatic } from "express-zod-api";
import { rawAcceptingEndpoint } from "./endpoints/accept-raw.ts";
import { createUserEndpoint } from "./endpoints/create-user.ts";
import { deleteUserEndpoint } from "./endpoints/delete-user.ts";
import { listUsersEndpoint } from "./endpoints/list-users.ts";
import { submitFeedbackEndpoint } from "./endpoints/submit-feedback.ts";
import { subscriptionEndpoint } from "./endpoints/time-subscription.ts";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar.ts";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user.ts";
import { sendAvatarEndpoint } from "./endpoints/send-avatar.ts";
import { updateUserEndpoint } from "./endpoints/update-user.ts";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar.ts";

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
      send: sendAvatarEndpoint.deprecated(), // demo for deprecated route
      stream: streamAvatarEndpoint,
      // file upload example
      upload: uploadAvatarEndpoint,
      // raw body acceptance example
      raw: rawAcceptingEndpoint,
    },
    // nested flat syntax:
    "events/stream": subscriptionEndpoint,
  },
  // flat syntax with explicitly specified method:
  "post /v1/forms/feedback": submitFeedbackEndpoint,
  // path /public serves static files from /assets
  public: new ServeStatic("assets", {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};
