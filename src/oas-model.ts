/**
 * This file is based on https://github.com/metadevpro/openapi3-ts
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017-2022 Metadev https://metadev.pro
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Typed interfaces for OpenAPI 3.0.3
// see https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md

import { ServerObject } from "./oas-common";
import {
  ISpecificationExtension,
  SpecificationExtension,
} from "./oas-extension";

export interface OpenAPIObject extends ISpecificationExtension {
  openapi: string;
  info: InfoObject;
  servers?: ServerObject[];
  paths: PathsObject;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
}
export interface InfoObject extends ISpecificationExtension {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}
export interface ContactObject extends ISpecificationExtension {
  name?: string;
  url?: string;
  email?: string;
}
export interface LicenseObject extends ISpecificationExtension {
  name: string;
  url?: string;
}

export interface ComponentsObject extends ISpecificationExtension {
  schemas?: { [schema: string]: SchemaObject | ReferenceObject };
  responses?: { [response: string]: ResponseObject | ReferenceObject };
  parameters?: { [parameter: string]: ParameterObject | ReferenceObject };
  examples?: { [example: string]: ExampleObject | ReferenceObject };
  requestBodies?: { [request: string]: RequestBodyObject | ReferenceObject };
  headers?: { [header: string]: HeaderObject | ReferenceObject };
  securitySchemes?: {
    [securityScheme: string]: SecuritySchemeObject | ReferenceObject;
  };
  links?: { [link: string]: LinkObject | ReferenceObject };
  callbacks?: { [callback: string]: CallbackObject | ReferenceObject };
}

/**
 * Rename it to Paths Object to be consistent with the spec
 * See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#pathsObject
 */
export interface PathsObject extends ISpecificationExtension {
  // [path: string]: PathItemObject;
  [path: string]: PathItemObject;
}

/**
 * @deprecated
 * Create a type alias for backward compatibility
 */
export type PathObject = PathsObject;

export function getPath(
  pathsObject: PathsObject,
  path: string
): PathItemObject | undefined {
  if (SpecificationExtension.isValidExtension(path)) {
    return undefined;
  }
  return pathsObject[path] as PathItemObject;
}

export interface PathItemObject extends ISpecificationExtension {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: (ParameterObject | ReferenceObject)[];
}
export interface OperationObject extends ISpecificationExtension {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses: ResponsesObject;
  callbacks?: CallbacksObject;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}
export interface ExternalDocumentationObject extends ISpecificationExtension {
  description?: string;
  url: string;
}

/**
 * The location of a parameter.
 * Possible values are "query", "header", "path" or "cookie".
 * Specification:
 * https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#parameter-locations
 */
export type ParameterLocation = "query" | "header" | "path" | "cookie";

/**
 * The style of a parameter.
 * Describes how the parameter value will be serialized.
 * (serialization is not implemented yet)
 * Specification:
 * https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#style-values
 */
export type ParameterStyle =
  | "matrix"
  | "label"
  | "form"
  | "simple"
  | "spaceDelimited"
  | "pipeDelimited"
  | "deepObject";

export interface BaseParameterObject extends ISpecificationExtension {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;

  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject | ReferenceObject;
  examples?: { [param: string]: ExampleObject | ReferenceObject };
  example?: any;
  content?: ContentObject;
}

export interface ParameterObject extends BaseParameterObject {
  name: string;
  in: ParameterLocation;
}
export interface RequestBodyObject extends ISpecificationExtension {
  description?: string;
  content: ContentObject;
  required?: boolean;
}
export interface ContentObject {
  [mediatype: string]: MediaTypeObject;
}
export interface MediaTypeObject extends ISpecificationExtension {
  schema?: SchemaObject | ReferenceObject;
  examples?: ExamplesObject;
  example?: any;
  encoding?: EncodingObject;
}
export interface EncodingObject extends ISpecificationExtension {
  [property: string]: EncodingPropertyObject | any; // Hack for allowing ISpecificationExtension
}
export interface EncodingPropertyObject {
  contentType?: string;
  headers?: { [key: string]: HeaderObject | ReferenceObject };
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  [key: string]: any; // (any) = Hack for allowing ISpecificationExtension
}
export interface ResponsesObject extends ISpecificationExtension {
  default?: ResponseObject | ReferenceObject;
  [statuscode: string]: ResponseObject | ReferenceObject | any; // (any) = Hack for allowing ISpecificationExtension
}
export interface ResponseObject extends ISpecificationExtension {
  description: string;
  headers?: HeadersObject;
  content?: ContentObject;
  links?: LinksObject;
}
export interface CallbacksObject extends ISpecificationExtension {
  [name: string]: CallbackObject | ReferenceObject | any; // Hack for allowing ISpecificationExtension
}
export interface CallbackObject extends ISpecificationExtension {
  [name: string]: PathItemObject | any; // Hack for allowing ISpecificationExtension
}
export interface HeadersObject {
  [name: string]: HeaderObject | ReferenceObject;
}
export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
  [property: string]: any; // Hack for allowing ISpecificationExtension
}
export interface LinksObject {
  [name: string]: LinkObject | ReferenceObject;
}
export interface LinkObject extends ISpecificationExtension {
  operationRef?: string;
  operationId?: string;
  parameters?: LinkParametersObject;
  requestBody?: any | string;
  description?: string;
  server?: ServerObject;
  [property: string]: any; // Hack for allowing ISpecificationExtension
}
export interface LinkParametersObject {
  [name: string]: any | string;
}
export interface HeaderObject extends BaseParameterObject {
  $ref?: string;
}
export interface TagObject extends ISpecificationExtension {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  [extension: string]: any; // Hack for allowing ISpecificationExtension
}
export interface ExamplesObject {
  [name: string]: ExampleObject | ReferenceObject;
}

export interface ReferenceObject {
  $ref: string;
}

/**
 * A type guard to check if the given value is a `ReferenceObject`.
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-guards-and-differentiating-types
 *
 * @param obj The value to check.
 */
export function isReferenceObject(obj: any): obj is ReferenceObject {
  return Object.prototype.hasOwnProperty.call(obj, "$ref");
}

export type SchemaObjectType =
  | "integer"
  | "number"
  | "string"
  | "boolean"
  | "object"
  | "null"
  | "array";

export type SchemaObjectFormat =
  | "int32"
  | "int64"
  | "float"
  | "double"
  | "byte"
  | "binary"
  | "date"
  | "date-time"
  | "password"
  | string;

export interface SchemaObject extends ISpecificationExtension {
  nullable?: boolean;
  discriminator?: DiscriminatorObject;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: XmlObject;
  externalDocs?: ExternalDocumentationObject;
  example?: any;
  examples?: any[];
  deprecated?: boolean;

  type?: SchemaObjectType | SchemaObjectType[];
  format?: SchemaObjectFormat;
  allOf?: (SchemaObject | ReferenceObject)[];
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  not?: SchemaObject | ReferenceObject;
  items?: SchemaObject | ReferenceObject;
  properties?: { [propertyName: string]: SchemaObject | ReferenceObject };
  additionalProperties?: SchemaObject | ReferenceObject | boolean;
  description?: string;
  default?: any;

  title?: string;
  multipleOf?: number;
  maximum?: number;
  /** @desc In OpenAPI 3.0: boolean*/
  exclusiveMaximum?: boolean;
  minimum?: number;
  /** @desc In OpenAPI 3.0: boolean */
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
}

/**
 * A type guard to check if the given object is a `SchemaObject`.
 * Useful to distinguish from `ReferenceObject` values that can be used
 * in most places where `SchemaObject` is allowed.
 *
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-guards-and-differentiating-types
 *
 * @param schema The value to check.
 */
export function isSchemaObject(
  schema: SchemaObject | ReferenceObject
): schema is SchemaObject {
  return !Object.prototype.hasOwnProperty.call(schema, "$ref");
}

export interface SchemasObject {
  [schema: string]: SchemaObject;
}

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: { [key: string]: string };
}

export interface XmlObject extends ISpecificationExtension {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}
export type SecuritySchemeType = "apiKey" | "http" | "oauth2" | "openIdConnect";

export interface SecuritySchemeObject extends ISpecificationExtension {
  type: SecuritySchemeType;
  description?: string;
  name?: string; // required only for apiKey
  in?: string; // required only for apiKey
  scheme?: string; // required only for http
  bearerFormat?: string;
  flows?: OAuthFlowsObject; // required only for oauth2
  openIdConnectUrl?: string; // required only for openIdConnect
}
export interface OAuthFlowsObject extends ISpecificationExtension {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}
export interface OAuthFlowObject extends ISpecificationExtension {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: ScopesObject;
}
export interface ScopesObject extends ISpecificationExtension {
  [scope: string]: any; // Hack for allowing ISpecificationExtension
}
export interface SecurityRequirementObject {
  [name: string]: string[];
}
