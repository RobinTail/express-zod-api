import { keys, reject, equals } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { Nestable } from "./routable";

export class DependsOnMethod extends Nestable {
  constructor(protected endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    super();
  }

  /** @desc [method, endpoint, siblingMethods] */
  public get entries(): ReadonlyArray<[Method, AbstractEndpoint, Method[]]> {
    const entries: Array<(typeof this.entries)[number]> = [];
    // @todo for..of pairs() ?
    const methods = keys(this.endpoints); // eslint-disable-line no-restricted-syntax -- literal type required
    for (const method of methods) {
      const endpoint = this.endpoints[method];
      if (endpoint)
        entries.push([method, endpoint, reject(equals(method), methods)]);
    }
    return Object.freeze(entries);
  }

  public override clone() {
    return new DependsOnMethod(this.endpoints) as this;
  }
}
