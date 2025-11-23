import { Routing, ServeStatic } from "express-zod-api";
import { rawAcceptingEndpoint } from "./endpoints/accept-raw";
import { createUserEndpoint } from "./endpoints/create-user";
import { deleteUserEndpoint } from "./endpoints/delete-user";
import { listUsersEndpoint } from "./endpoints/list-users";
import { submitFeedbackEndpoint } from "./endpoints/submit-feedback";
import { subscriptionEndpoint } from "./endpoints/time-subscription";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user";
import { sendAvatarEndpoint } from "./endpoints/send-avatar";
import { updateUserEndpoint } from "./endpoints/update-user";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar";

export const routing: Routing = {
  v1: {
    user: {
      // syntax 1: methods are defined within the endpoint
      retrieve: retrieveUserEndpoint, // path: /v1/user/retrieve
      // id is the route path param
      ":id": {
        remove: deleteUserEndpoint, // nested path: /v1/user/:id/remove
        // syntax 2: methods are defined within the route
        patch: updateUserEndpoint, // demonstrates authentication
      },
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
