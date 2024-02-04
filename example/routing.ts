import { join } from "node:path";
import { DependsOnMethod, Routing, ServeStatic } from "../src";
import { ActionMap } from "../src/sockets";
import { onSubscribe } from "./actions/subscribe";
import { onPing } from "./actions/ping";
import { rawAcceptingEndpoint } from "./endpoints/accept-raw";
import { createUserEndpoint } from "./endpoints/create-user";
import { listUsersEndpoint } from "./endpoints/list-users";
import { retrieveUserEndpoint } from "./endpoints/retrieve-user";
import { sendAvatarEndpoint } from "./endpoints/send-avatar";
import { streamAvatarEndpoint } from "./endpoints/stream-avatar";
import { updateUserEndpoint } from "./endpoints/update-user";
import { uploadAvatarEndpoint } from "./endpoints/upload-avatar";

export const routing: Routing = {
  v1: {
    user: {
      // syntax 1: methods are defined within the endpoint
      retrieve: retrieveUserEndpoint, // path: /v1/user/retrieve
      // syntax 2: methods are defined within the route (id is the route path param by the way)
      ":id": new DependsOnMethod({
        // the endpoints listed here must support at least the same method they are assigned to
        patch: updateUserEndpoint, // demonstrates authentication
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
  },
  // path /public serves static files from /example/assets
  public: new ServeStatic(join("example", "assets"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
  }),
};

/** @desc the object declares handling rules of the incoming socket.io events */
export const actions: ActionMap = { ping: onPing, subscribe: onSubscribe };
