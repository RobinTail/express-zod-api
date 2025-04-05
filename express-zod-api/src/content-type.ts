export const contentTypes = {
  json: "application/json",
  upload: "multipart/form-data",
  raw: "application/octet-stream",
  sse: "text/event-stream",
  form: "application/x-www-form-urlencoded",
};

export type ContentType = keyof typeof contentTypes;
