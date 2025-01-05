import { defaultEndpointsFactory, TagOverrides } from "express-zod-api";

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
