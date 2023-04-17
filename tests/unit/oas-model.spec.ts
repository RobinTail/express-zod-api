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

import {
  ReferenceObject,
  SchemaObject,
  isReferenceObject,
  isSchemaObject,
} from "../../src/oas-model";
import { IExtensionName, IExtensionType } from "../../src/oas-extension";

describe("OAS Model type guards", () => {
  class TestSchemaObject implements SchemaObject {
    [k: IExtensionName]: IExtensionType;
    // empty schema
  }

  class TestReferenceObject implements ReferenceObject {
    $ref = "test";
  }

  describe("isSchemaObject()", () => {
    it("returns true for a schema object", () => {
      const schemaObject = new TestSchemaObject();
      expect(isSchemaObject(schemaObject)).toBe(true);
    });

    it("returns false for a reference object", () => {
      const referenceObject = new TestReferenceObject();
      expect(isSchemaObject(referenceObject)).toBe(false);
    });
  });

  describe("isReferenceObject()", () => {
    it("returns true for a reference object", () => {
      const referenceObject = new TestReferenceObject();
      expect(isReferenceObject(referenceObject)).toBe(true);
    });

    it("returns false for a schema object", () => {
      const schemaObject = new TestSchemaObject();
      expect(isReferenceObject(schemaObject)).toBe(false);
    });
  });
});
