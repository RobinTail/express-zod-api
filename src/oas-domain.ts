import { oas30, oas31 } from "openapi3-ts";

export type OASVersion = "3.0" | "3.1";

export type OpenApiBuilder = oas30.OpenApiBuilder | oas31.OpenApiBuilder;
export type SchemaObject = oas30.SchemaObject | oas31.SchemaObject;
export type ReferenceObject = oas30.ReferenceObject | oas31.ReferenceObject;
export type SecuritySchemeType =
  | oas30.SecuritySchemeType
  | oas31.SecuritySchemeType;
export type SecuritySchemeObject =
  | oas30.SecuritySchemeObject
  | oas31.SecuritySchemeObject;
export type OperationObject = oas30.OperationObject | oas31.OperationObject;

export const isSchemaObject31 = (subject: any): subject is oas31.SchemaObject =>
  oas31.isSchemaObject(subject);

export const isSchemaObject30 = (subject: any): subject is oas30.SchemaObject =>
  oas30.isSchemaObject(subject);

export const isOpenApiBuilder31 = (
  subject: any
): subject is oas31.OpenApiBuilder => subject instanceof oas31.OpenApiBuilder;

export const isOpenApiBuilder30 = (
  subject: any
): subject is oas30.OpenApiBuilder => subject instanceof oas30.OpenApiBuilder;

export const makeBuilder = (version: OASVersion) =>
  new (version === "3.1" ? oas31 : oas30).OpenApiBuilder();
