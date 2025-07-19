import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { isMethod, Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";

/** @todo check if still need to export */
export type OnEndpoint = (
  endpoint: AbstractEndpoint,
  path: string,
  method: Method,
) => void;

interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: OnEndpoint;
  onStatic?: (path: string, handler: StaticHandler) => void;
}

/** @example delete /v1/user/retrieve —> [/v1/user/retrieve, delete] */
const detachMethod = (subject: string): [string, Method?] => {
  const [method, rest] = subject.trim().split(/ (.+)/, 2);
  if (rest && isMethod(method)) return [rest, method];
  return [subject];
};

/** Removes whitespace and slashes from the edges of the string */
const trimPath = (path: string) =>
  path.trim().split("/").filter(Boolean).join("/");

const processEntries = (subject: Routing, parent?: string) =>
  Object.entries(subject).map<[string, Routing[string], Method?]>(
    ([_key, item]) => {
      const [segment, method] = detachMethod(_key);
      const path = [parent || ""].concat(trimPath(segment) || []).join("/");
      return [path, item, method];
    },
  );

const prohibit = (method: Method, path: string) => {
  throw new RoutingError(
    "Route with explicit method can only be assigned with Endpoint",
    method,
    path,
  );
};

const checkMethodSupported = (
  method: Method,
  path: string,
  methods?: ReadonlyArray<Method>,
) => {
  if (!methods || methods.includes(method)) return;
  throw new RoutingError(
    `Method ${method} is not supported by the assigned Endpoint.`,
    method,
    path,
  );
};

const checkDuplicate = (method: Method, path: string, visited: Set<string>) => {
  const key = `${method} ${path}`;
  if (visited.has(key))
    throw new RoutingError("Route has a duplicate", method, path);
  visited.add(key);
};

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
}: RoutingWalkerParams) => {
  const stack = processEntries(routing);
  const visited = new Set<string>();
  while (stack.length) {
    const [path, element, explicitMethod] = stack.shift()!;
    if (element instanceof AbstractEndpoint) {
      if (explicitMethod) {
        checkDuplicate(explicitMethod, path, visited);
        checkMethodSupported(explicitMethod, path, element.methods);
        onEndpoint(element, path, explicitMethod);
      } else {
        const { methods = ["get"] } = element;
        for (const method of methods) {
          checkDuplicate(method, path, visited);
          onEndpoint(element, path, method);
        }
      }
    } else {
      if (explicitMethod) prohibit(explicitMethod, path);
      if (element instanceof ServeStatic) {
        if (onStatic) element.apply(path, onStatic);
      } else if (element instanceof DependsOnMethod) {
        for (const [method, endpoint] of element.entries) {
          const { methods } = endpoint;
          checkDuplicate(method, path, visited);
          checkMethodSupported(method, path, methods);
          onEndpoint(endpoint, path, method);
        }
      } else {
        stack.unshift(...processEntries(element, path));
      }
    }
  }
};
