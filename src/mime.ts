import mime from "mime";

export const mimeJson = mime.getType("json") || "application/json";
export const mimeMultipart = "multipart/form-data";

export type MimeDefinition = string | string[];
