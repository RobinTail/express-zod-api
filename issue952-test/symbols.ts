import { ez } from "express-zod-api";

export const schemas = {
  raw: ez.raw(),
  file: ez.buffer(),
  dateIn: ez.dateIn(),
  dateOut: ez.dateOut(),
  upload: ez.upload(),
  form: ez.form({}),
};
