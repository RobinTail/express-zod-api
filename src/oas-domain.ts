import { oas30, oas31 } from "openapi3-ts";

export type OASVersion = "3.0" | "3.1";

export type OpenApiBuilder = oas30.OpenApiBuilder | oas31.OpenApiBuilder;
export type SchemaObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.SchemaObject
  : oas30.SchemaObject;
export type ReferenceObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.ReferenceObject
  : oas30.ReferenceObject;
export type SecuritySchemeType =
  | oas30.SecuritySchemeType
  | oas31.SecuritySchemeType;
export type SecuritySchemeObject =
  | oas30.SecuritySchemeObject
  | oas31.SecuritySchemeObject;
export type OperationObject = oas30.OperationObject | oas31.OperationObject;
export type ContentObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.ContentObject
  : oas30.ContentObject;
export type ExampleObject = oas30.ExampleObject | oas31.ExampleObject;
export type ExamplesObject = oas30.ExamplesObject | oas31.ExamplesObject;
export type MediaTypeObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.MediaTypeObject
  : oas30.MediaTypeObject;
export type OAuthFlowsObject = oas30.OAuthFlowsObject | oas31.OAuthFlowsObject;
export type ParameterObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.ParameterObject
  : oas30.ParameterObject;
export type RequestBodyObject<V extends OASVersion = OASVersion> =
  V extends "3.1" ? oas31.RequestBodyObject : oas30.RequestBodyObject;
export type ResponseObject<V extends OASVersion = OASVersion> = V extends "3.1"
  ? oas31.ResponseObject
  : oas30.ResponseObject;
export type SchemaObjectType<V extends OASVersion = OASVersion> =
  V extends "3.1" ? oas31.SchemaObjectType : oas30.SchemaObjectType;
export type SecurityRequirementObject =
  | oas30.SecurityRequirementObject
  | oas31.SecurityRequirementObject;
export type TagObject = oas30.TagObject | oas31.TagObject;

export const isSchemaObject31 = (subject: any): subject is oas31.SchemaObject =>
  oas31.isSchemaObject(subject);

export const isSchemaObject30 = (subject: any): subject is oas30.SchemaObject =>
  oas30.isSchemaObject(subject);

export const isSchemaObject = (subject: any): subject is SchemaObject =>
  isSchemaObject30(subject) || isSchemaObject31(subject);

export const isReferenceObject31 = (
  subject: any
): subject is oas31.ReferenceObject => oas31.isReferenceObject(subject);

export const isReferenceObject30 = (
  subject: any
): subject is oas30.ReferenceObject => oas30.isReferenceObject(subject);

export const isReferenceObject = (subject: any): subject is ReferenceObject =>
  isReferenceObject30(subject) || isReferenceObject31(subject);

export const isOpenApiBuilder31 = (
  subject: any
): subject is oas31.OpenApiBuilder => subject instanceof oas31.OpenApiBuilder;

export const isOpenApiBuilder30 = (
  subject: any
): subject is oas30.OpenApiBuilder => subject instanceof oas30.OpenApiBuilder;

export const makeBuilder = (version: OASVersion) =>
  new (version === "3.1" ? oas31 : oas30).OpenApiBuilder();

export const assertVersion = <V extends OASVersion>(
  version: V,
  schema: SchemaObject | ReferenceObject
) => schema as SchemaObject<V> | ReferenceObject<V>;
