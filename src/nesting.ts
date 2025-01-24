import { Routing } from "./routing";

export abstract class Nesting {
  /** @desc Enables nested routes within the path assigned to the subject */
  public nest(routing: Routing): Routing {
    return Object.assign(routing, { "": this });
  }
}
