import mime from "mime";

export const mimeJson = mime.getType("json") || "application/json";
export const mimeMultipart = "multipart/form-data";

// @todo remove in v9
export type MimeDefinition = string | string[];
