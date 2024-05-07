export const contentTypes = {
  json: "application/json",
  upload: "multipart/form-data",
  raw: "application/octet-stream",
};

export type ContentType = keyof typeof contentTypes;
