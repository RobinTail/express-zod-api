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

import * as yaml from "yaml";
import * as oa from "./oas-model";
import { ServerObject } from "./oas-common";

// Internal DSL for building an OpenAPI 3.0.x contract using a fluent interface

export class OpenApiBuilder {
  rootDoc: oa.OpenAPIObject;

  static create(doc?: oa.OpenAPIObject): OpenApiBuilder {
    return new OpenApiBuilder(doc);
  }

  constructor(doc?: oa.OpenAPIObject) {
    this.rootDoc = doc || {
      openapi: "3.0.0",
      info: {
        title: "app",
        version: "version",
      },
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {},
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: {},
        links: {},
        callbacks: {},
      },
      tags: [],
      servers: [],
    };
  }

  getSpec(): oa.OpenAPIObject {
    return this.rootDoc;
  }

  getSpecAsJson(
    replacer?: (key: string, value: unknown) => unknown,
    space?: string | number
  ): string {
    return JSON.stringify(this.rootDoc, replacer, space);
  }
  getSpecAsYaml(): string {
    return yaml.stringify(this.rootDoc);
  }

  private static isValidOpenApiVersion(v: string): boolean {
    v = v || "";
    const match = /(\d+)\.(\d+).(\d+)/.exec(v);
    if (match) {
      const major = parseInt(match[1], 10);
      if (major >= 3) {
        return true;
      }
    }
    return false;
  }

  addOpenApiVersion(openApiVersion: string): OpenApiBuilder {
    if (!OpenApiBuilder.isValidOpenApiVersion(openApiVersion)) {
      throw new Error(
        "Invalid OpenApi version: " +
          openApiVersion +
          ". Follow convention: 3.x.y"
      );
    }
    this.rootDoc.openapi = openApiVersion;
    return this;
  }
  addInfo(info: oa.InfoObject): OpenApiBuilder {
    this.rootDoc.info = info;
    return this;
  }
  addContact(contact: oa.ContactObject): OpenApiBuilder {
    this.rootDoc.info.contact = contact;
    return this;
  }
  addLicense(license: oa.LicenseObject): OpenApiBuilder {
    this.rootDoc.info.license = license;
    return this;
  }
  addTitle(title: string): OpenApiBuilder {
    this.rootDoc.info.title = title;
    return this;
  }
  addDescription(description: string): OpenApiBuilder {
    this.rootDoc.info.description = description;
    return this;
  }
  addTermsOfService(termsOfService: string): OpenApiBuilder {
    this.rootDoc.info.termsOfService = termsOfService;
    return this;
  }
  addVersion(version: string): OpenApiBuilder {
    this.rootDoc.info.version = version;
    return this;
  }
  addPath(path: string, pathItem: oa.PathItemObject): OpenApiBuilder {
    this.rootDoc.paths[path] = {
      ...(this.rootDoc.paths[path] || {}),
      ...pathItem,
    };
    return this;
  }
  addSchema(
    name: string,
    schema: oa.SchemaObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.schemas = this.rootDoc.components.schemas || {};
    this.rootDoc.components.schemas[name] = schema;
    return this;
  }
  addResponse(
    name: string,
    response: oa.ResponseObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.responses = this.rootDoc.components.responses || {};
    this.rootDoc.components.responses[name] = response;
    return this;
  }
  addParameter(
    name: string,
    parameter: oa.ParameterObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.parameters =
      this.rootDoc.components.parameters || {};
    this.rootDoc.components.parameters[name] = parameter;
    return this;
  }
  addExample(
    name: string,
    example: oa.ExampleObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.examples = this.rootDoc.components.examples || {};
    this.rootDoc.components.examples[name] = example;
    return this;
  }
  addRequestBody(
    name: string,
    reqBody: oa.RequestBodyObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.requestBodies =
      this.rootDoc.components.requestBodies || {};
    this.rootDoc.components.requestBodies[name] = reqBody;
    return this;
  }
  addHeader(
    name: string,
    header: oa.HeaderObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.headers = this.rootDoc.components.headers || {};
    this.rootDoc.components.headers[name] = header;
    return this;
  }
  addSecurityScheme(
    name: string,
    secScheme: oa.SecuritySchemeObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.securitySchemes =
      this.rootDoc.components.securitySchemes || {};
    this.rootDoc.components.securitySchemes[name] = secScheme;
    return this;
  }
  addLink(
    name: string,
    link: oa.LinkObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.links = this.rootDoc.components.links || {};
    this.rootDoc.components.links[name] = link;
    return this;
  }
  addCallback(
    name: string,
    callback: oa.CallbackObject | oa.ReferenceObject
  ): OpenApiBuilder {
    this.rootDoc.components = this.rootDoc.components || {};
    this.rootDoc.components.callbacks = this.rootDoc.components.callbacks || {};
    this.rootDoc.components.callbacks[name] = callback;
    return this;
  }
  addServer(server: ServerObject): OpenApiBuilder {
    this.rootDoc.servers = this.rootDoc.servers || [];
    this.rootDoc.servers.push(server);
    return this;
  }
  addTag(tag: oa.TagObject): OpenApiBuilder {
    this.rootDoc.tags = this.rootDoc.tags || [];
    this.rootDoc.tags.push(tag);
    return this;
  }
  addExternalDocs(extDoc: oa.ExternalDocumentationObject): OpenApiBuilder {
    this.rootDoc.externalDocs = extDoc;
    return this;
  }
}
