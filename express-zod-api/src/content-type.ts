export const contentTypes = {
  json: "application/json",
  upload: "multipart/form-data",
  raw: "application/octet-stream",
  sse: "text/event-stream",
};

export type ContentType = keyof typeof contentTypes;
export type RequestType = Extract<ContentType, "json" | "upload" | "raw">;
