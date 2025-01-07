import { keys, reject, equals } from "ramda";
import { AbstractEndpoint } from "./endpoint.ts";
import { Method } from "./method.ts";
import { Nesting } from "./nesting.ts";

export class DependsOnMethod extends Nesting {
  /** @desc [method, endpoint, siblingMethods] */
  public readonly entries: ReadonlyArray<[Method, AbstractEndpoint, Method[]]>;

  constructor(endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    super();
    const entries: Array<(typeof this.entries)[number]> = [];
    const methods = keys(endpoints); // eslint-disable-line no-restricted-syntax -- liternal type required
    for (const method of methods) {
      const endpoint = endpoints[method];
      if (endpoint)
        entries.push([method, endpoint, reject(equals(method), methods)]);
    }
    this.entries = Object.freeze(entries);
  }
}
