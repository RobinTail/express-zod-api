import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";

export class DependsOnMethod {
  constructor(
    public readonly endpoints: Partial<Record<Method, AbstractEndpoint>>,
  ) {}
}
