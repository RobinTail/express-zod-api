import { ZodDate } from "zod";
import { withGetType } from "@express-zod-api/zod-to-ts";
import { ZodDateIn } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";
import { ZodFile } from "./file-schema";
import { ZodUpload } from "./upload-schema";

export * from "zod";
export const file = ZodFile.create;
export const upload = ZodUpload.create;

/**
 * @description z.date() represents the Date, it should not be used within IO schemas
 * @deprecated Please use z.dateIn() or z.dateOut() within IO schemas
 * */
export const date = ZodDate.create;
export const dateIn = (...params: Parameters<typeof ZodDateIn.create>) =>
  withGetType(ZodDateIn.create(...params), (ts) =>
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
export const dateOut = (...params: Parameters<typeof ZodDateOut.create>) =>
  withGetType(ZodDateOut.create(...params), (ts) =>
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
