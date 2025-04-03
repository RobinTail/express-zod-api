export const contentTypes = {
  json: "application/json",
  multipart: "multipart/form-data",
  raw: "application/octet-stream",
  sse: "text/event-stream",
};

export type ContentType = keyof typeof contentTypes;
export type RequestType = Extract<ContentType, "json" | "multipart" | "raw">;
