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

import { Server, ServerVariable } from "../../src/oas-server";

describe("OAS Server", () => {
  it("create server", () => {
    const v1 = new ServerVariable("dev", ["dev", "qa", "prod"], "environment");
    const sut = new Server("http://api.qa.machine.org", "qa maquine");
    sut.addVariable("environment", v1);

    expect(sut.url).toBe("http://api.qa.machine.org");
    expect(sut.description).toBe("qa maquine");
    expect(sut.variables.environment.default).toBe("dev");
  });
});

describe("ServerVariable", () => {
  it("server var", () => {
    const sut = new ServerVariable("dev", ["dev", "qa", "prod"], "environment");

    expect(sut.default).toBe("dev");
    expect(sut.description).toBe("environment");
    expect(sut.enum).toStrictEqual(["dev", "qa", "prod"]);
  });
});
