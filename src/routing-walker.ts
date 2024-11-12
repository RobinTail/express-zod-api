import assert from "node:assert/strict";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { RoutingError } from "./errors";
import { AuxMethod, Method } from "./method";
import { Routing } from "./routing";
import { ServeStatic, StaticHandler } from "./serve-static";

const fallbackMethod: Method = "get";

export interface RoutingWalkerParams {
  routing: Routing;
  onEndpoint: (
    endpoint: AbstractEndpoint,
    path: string,
    // @todo just Method
    method: Method | AuxMethod,
    siblingMethods?: ReadonlyArray<Method>,
  ) => void;
  onStatic?: (path: string, handler: StaticHandler) => void;
  parentPath?: string;
}

export const walkRouting = ({
  routing,
  onEndpoint,
  onStatic,
  parentPath,
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
      const methods: (Method | AuxMethod)[] = element.getMethods()?.slice() || [
        fallbackMethod,
      ];
      for (const method of methods) onEndpoint(element, path, method);
    } else if (element instanceof ServeStatic) {
      if (onStatic) element.apply(path, onStatic);
    } else if (element instanceof DependsOnMethod) {
      for (const [method, endpoint] of element.pairs) {
        const supportedMethods = endpoint.getMethods();
        assert(
          !supportedMethods || supportedMethods.includes(method),
          new RoutingError(
            `Endpoint assigned to ${method} method of ${path} must support ${method} method.`,
          ),
        );
        onEndpoint(endpoint, path, method, element.siblingMethods);
      }
    } else {
      walkRouting({ onEndpoint, onStatic, routing: element, parentPath: path });
    }
  }
};
