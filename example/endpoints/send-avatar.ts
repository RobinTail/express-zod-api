import { z } from "zod";
import { fileSendingEndpointsFactory } from "../factories";
import { readFile } from "node:fs/promises";
import camelize from "camelize-ts";

export const sendAvatarEndpoint = fileSendingEndpointsFactory.build({
  method: "get",
  shortDescription: "Sends a file content.",
  tags: ["files", "users"],
  input: z
    .object({
      user_id: z
        .string()
        .regex(/\d+/)
        .transform((str) => parseInt(str, 10)),
    }) // top level transformation demo: object keys mapping
    .transform((input) => camelize(input)),
  output: z.object({
    data: z.string(),
  }),
  handler: async ({ input: { userId }, logger }) => {
    logger.debug("userId (user_id)", userId);
    const data = await readFile("logo.svg", "utf-8");
    return { data };
  },
});
