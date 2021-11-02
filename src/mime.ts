import { getType } from "mime";

export const mimeJson = getType("json") || "application/json";
export const mimeMultipart = "multipart/form-data";

export type MimeDefinition = string | string[];
