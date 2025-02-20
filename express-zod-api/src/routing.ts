import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { ServeStatic } from "./serve-static";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export abstract class Routable {
  /** @desc Marks the route as deprecated (makes a copy of the endpoint) */
  public abstract deprecated(): this;

  /** @desc Enables nested routes within the path assigned to the subject */
  public nest(routing: Routing): Routing {
    return Object.assign(routing, { "": this });
  }
}
