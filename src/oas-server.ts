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

import { ServerObject, ServerVariableObject } from "./oas-common";
import { IExtensionName, IExtensionType } from "./oas-extension";

// Server & Server Variable
export class Server implements ServerObject {
  url: string;
  description?: string;
  variables: { [v: string]: ServerVariable };
  [k: IExtensionName]: IExtensionType;

  constructor(url: string, desc?: string) {
    this.url = url;
    this.description = desc;
    this.variables = {};
  }
  addVariable(name: string, variable: ServerVariable): void {
    this.variables[name] = variable;
  }
}

export class ServerVariable implements ServerVariableObject {
  enum?: string[] | boolean[] | number[];
  default: string | boolean | number;
  description?: string;
  [k: IExtensionName]: IExtensionType;

  constructor(
    defaultValue: string | boolean | number,
    enums?: string[] | boolean[] | number[],
    description?: string
  ) {
    this.default = defaultValue;
    this.enum = enums;
    this.description = description;
  }
}
