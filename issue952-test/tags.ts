import { defaultEndpointsFactory, type TagOverrides } from "express-zod-api";
import { Documentation } from "express-zod-api/documentation";

declare module "express-zod-api" {
  export interface TagOverrides {
    users: unknown;
    files: unknown;
    subscriptions: unknown;
  }
}

defaultEndpointsFactory.buildVoid({
  tag: "users",
  handler: async () => {},
});

defaultEndpointsFactory.buildVoid({
  tag: ["users", "files"],
  handler: async () => {},
});

expectTypeOf<TagOverrides>().toEqualTypeOf<{
  users: unknown;
  files: unknown;
  subscriptions: unknown;
}>();

new Documentation({
  info: { title: "", version: "" },
  server: "",
  routing: {},
  config: { cors: false },
  tags: {
    users: "",
    files: { description: "", url: "" },
  },
});
