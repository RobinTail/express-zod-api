import { keys, reject, equals } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { Nesting } from "./nesting";

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
