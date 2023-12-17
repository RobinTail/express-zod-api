import type {
  OperationObject as Operation30,
  ReferenceObject as Ref30,
  SchemaObject as Schema30,
  SecuritySchemeObject as Security30,
} from "openapi3-ts/oas30";
import type {
  OperationObject as Operation31,
  ReferenceObject as Ref31,
  SchemaObject as Schema31,
  SecuritySchemeObject as Security31,
} from "openapi3-ts/oas31";

export type OAS = "3.0" | "3.1";

// intersecions
export type CommonSchema = Schema30 & Schema31;
export type CommonRef = Ref30 & Ref31;
export type CommonSecurity = Security30 & Security31;

// shortening
export type CommonSchemaOrRef = CommonSchema | CommonRef;

// unions
// @todo clarify
export type SomeOperation = Operation30 | Operation31;

// re-export
export type SchemaObject30 = Schema30;
export type SchemaObject31 = Schema31;
