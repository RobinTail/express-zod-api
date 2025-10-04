import { AbstractEndpoint } from "./endpoint.ts";
import { RoutingError } from "./errors.ts";
import { ClientMethod, isMethod, Method } from "./method.ts";
import { Routing } from "./routing.ts";
import { ServeStatic, StaticHandler } from "./serve-static.ts";

export type OnEndpoint<M extends string = Method> = (
  method: M,
  path: string,
  endpoint: AbstractEndpoint,
) => void;

/** Calls the given hook with HEAD each time it's called with GET method */
export const withHead =
  (onEndpoint: OnEndpoint<ClientMethod>): OnEndpoint =>
  (method, ...rest) => {
    onEndpoint(method, ...rest);
    if (method === "get") onEndpoint("head", ...rest);
  };

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
        onEndpoint(explicitMethod, path, element);
      } else {
        const { methods = ["get"] } = element;
        for (const method of methods) {
          checkDuplicate(method, path, visited);
          onEndpoint(method, path, element);
        }
      }
    } else {
      if (explicitMethod) prohibit(explicitMethod, path);
      if (element instanceof ServeStatic) {
        if (onStatic) element.apply(path, onStatic);
      } else {
        stack.unshift(...processEntries(element, path));
      }
    }
  }
};
