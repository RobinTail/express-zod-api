import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";

export interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: (
    endpoint: AbstractEndpoint,
    path: string,
    method: Method,
    siblingMethods?: ReadonlyArray<Method>,
  ) => void;
  onStatic?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
}

const makePairs = (subject: Routing, parent?: string) =>
  Object.entries(subject).map(([segment, item]) => {
    if (segment.includes("/")) {
      throw new RoutingError(
        `The entry '${segment}' must avoid having slashes — use nesting instead.`,
      );
    }
    const trimmed = segment.trim();
    return [`${parent || ""}${trimmed ? `/${trimmed}` : ""}`, item] as const;
  });

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
}: RoutingWalkerParams) => {
  const stack = makePairs(routing);
  while (stack.length) {
    const [path, element] = stack.shift()!;
    if (element instanceof AbstractEndpoint) {
      const methods = element.getMethods() || ["get"];
      for (const method of methods) onEndpoint(element, path, method);
    } else if (element instanceof ServeStatic) {
      if (onStatic) element.apply(path, onStatic);
    } else if (element instanceof DependsOnMethod) {
      for (const [method, endpoint, siblingMethods] of element.entries) {
        const supportedMethods = endpoint.getMethods();
        if (supportedMethods && !supportedMethods.includes(method)) {
          throw new RoutingError(
            `Endpoint assigned to ${method} method of ${path} must support ${method} method.`,
          );
        }
        onEndpoint(endpoint, path, method, siblingMethods);
      }
    } else {
      stack.push(...makePairs(element, path));
    }
  }
};
