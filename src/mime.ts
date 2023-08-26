import { lookup } from "mime-types";

export const mimeJson = lookup("json") || "application/json";
export const mimeMultipart = "multipart/form-data";
