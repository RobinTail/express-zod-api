import assert from "node:assert/strict";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { AuxMethod, Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";

export interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: (
    endpoint: AbstractEndpoint,
    path: string,
    method: Method | AuxMethod,
    siblingMethods?: ReadonlyArray<Method>,
  ) => void;
  onStatic?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
  hasCors?: boolean;
}

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
  parentPath,
  hasCors,
}: RoutingWalkerParams) => {
  const pairs = Object.entries(routing).map(
    ([key, value]) => [key.trim(), value] as const,
  );
  for (const [segment, element] of pairs) {
    assert.doesNotMatch(
      segment,
      /\//,
      new RoutingError(
        `The entry '${segment}' must avoid having slashes — use nesting instead.`,
      ),
    );
    const path = `${parentPath || ""}${segment ? `/${segment}` : ""}`;
    if (element instanceof AbstractEndpoint) {
      const methods: (Method | AuxMethod)[] = element.getMethods().slice();
      if (hasCors) methods.push("options");
      for (const method of methods) onEndpoint(element, path, method);
    } else if (element instanceof ServeStatic) {
      if (onStatic) element.apply(path, onStatic);
    } else if (element instanceof DependsOnMethod) {
      for (const [method, endpoint] of element.pairs) {
        assert(
          endpoint.getMethods().includes(method),
          new RoutingError(
            `Endpoint assigned to ${method} method of ${path} must support ${method} method.`,
          ),
        );
        onEndpoint(endpoint, path, method);
      }
      if (hasCors && element.firstEndpoint) {
        onEndpoint(
          element.firstEndpoint,
          path,
          "options",
          element.siblingMethods,
        );
      }
    } else {
      walkRouting({
        onEndpoint,
        onStatic,
        hasCors,
        routing: element,
        parentPath: path,
      });
    }
  }
};
