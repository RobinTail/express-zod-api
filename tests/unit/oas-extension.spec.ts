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

import { SpecificationExtension } from "../../src/oas-extension";

describe("SpecificationExtension", () => {
  it("addExtension() ok", () => {
    const sut = new SpecificationExtension();
    const extensionValue = { payload: 5 };
    sut.addExtension("x-name", extensionValue);

    expect(sut["x-name"]).toEqual(extensionValue);
  });
  it("addExtension() invalid", () => {
    const sut = new SpecificationExtension();
    const extensionValue = { payload: 5 };
    expect(() => sut.addExtension("y-name", extensionValue)).toThrow();
  });
  it("getExtension() ok", () => {
    const sut = new SpecificationExtension();
    const extensionValue1 = { payload: 5 };
    const extensionValue2 = { payload: 6 };
    sut.addExtension("x-name", extensionValue1);
    sut.addExtension("x-load", extensionValue2);

    expect(sut.getExtension("x-name")).toEqual(extensionValue1);
    expect(sut.getExtension("x-load")).toEqual(extensionValue2);
  });
  it("getExtension() invalid", () => {
    const sut = new SpecificationExtension();
    expect(() => sut.getExtension("y-name")).toThrow();
  });
  it("getExtension() not found", () => {
    const sut = new SpecificationExtension();
    expect(sut.getExtension("x-resource")).toBeNull();
  });
  it("listExtensions()", () => {
    const sut = new SpecificationExtension();
    const extensionValue1 = { payload: 5 };
    const extensionValue2 = { payload: 6 };
    sut.addExtension("x-name", extensionValue1);
    sut.addExtension("x-load", extensionValue2);

    expect(sut.listExtensions()).toEqual(["x-name", "x-load"]);
  });
});
