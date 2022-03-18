import mime from "mime";

export const mimeJson = mime.getType("json") || "application/json";
export const mimeMultipart = "multipart/form-data";

// @todo decide on this
export type MimeDefinition = string | string[];
