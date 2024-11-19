import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";

export type EndpointHook = (
  endpoint: AbstractEndpoint,
  path: string,
  method: Method,
  siblingMethods?: ReadonlyArray<Method>,
) => void;

interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: EndpointHook | EndpointHook[];
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
  const hooks = typeof onEndpoint === "function" ? [onEndpoint] : onEndpoint;
  const stack = makePairs(routing);
  while (stack.length) {
    const [path, element] = stack.shift()!;
    if (element instanceof AbstractEndpoint) {
      const methods = element.getMethods() || ["get"];
      for (const method of methods)
        for (const hook of hooks) hook(element, path, method);
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
        for (const hook of hooks) hook(endpoint, path, method, siblingMethods);
      }
    } else {
      stack.unshift(...makePairs(element, path));
    }
  }
};
