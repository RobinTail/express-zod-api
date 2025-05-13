import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { isMethod, Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";
import * as R from "ramda";

export type OnEndpoint = (
  endpoint: AbstractEndpoint,
  path: string,
  method: Method,
  siblingMethods?: ReadonlyArray<Method>,
) => void;

interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: OnEndpoint;
  onStatic?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
}

/** @example delete /v1/user/retrieve —> [/v1/user/retrieve, delete] */
const detachMethod = (subject: string): [string, Method?] => {
  const [method, rest] = subject.trim().split(/ (.+)/, 2);
  if (rest && isMethod(method)) return [rest, method];
  return [subject];
};

/** Removes whitespace and slashes from the edges of the string */
const trimPath = R.pipe(R.trim, R.split("/"), R.reject(R.isEmpty), R.join("/"));

const processEntries = (subject: Routing, parent?: string) =>
  Object.entries(subject).map<[string, Routing[string], Method?]>(
    ([_key, item]) => {
      const [_path, method] = detachMethod(_key);
      const path = [parent || ""].concat(trimPath(_path) || []).join("/");
      return [path, item, method];
    },
  );

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
}: RoutingWalkerParams) => {
  const stack = processEntries(routing);
  while (stack.length) {
    const [path, element] = stack.shift()!;
    if (element instanceof AbstractEndpoint) {
      const { methods = ["get"] } = element;
      for (const method of methods) onEndpoint(element, path, method);
    } else if (element instanceof ServeStatic) {
      if (onStatic) element.apply(path, onStatic);
    } else if (element instanceof DependsOnMethod) {
      for (const [method, endpoint, siblingMethods] of element.entries) {
        const { methods } = endpoint;
        if (methods && !methods.includes(method)) {
          throw new RoutingError(
            `Endpoint assigned to ${method} method of ${path} must support ${method} method.`,
          );
        }
        onEndpoint(endpoint, path, method, siblingMethods);
      }
    } else {
      stack.unshift(...processEntries(element, path));
    }
  }
};
