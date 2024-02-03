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
    siblingMethods?: Method[],
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
  Object.entries(routing).forEach(([segment, element]) => {
    segment = segment.trim();
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
      if (hasCors) {
        methods.push("options");
      }
      methods.forEach((method) => {
        onEndpoint(element, path, method);
      });
    } else if (element instanceof ServeStatic) {
      if (onStatic) {
        element.apply(path, onStatic);
      }
    } else if (element instanceof DependsOnMethod) {
      element.pairs.forEach(([method, endpoint]) => {
        assert(
          endpoint.getMethods().includes(method),
          new RoutingError(
            `Endpoint assigned to ${method} method of ${path} must support ${method} method.`,
          ),
        );
        onEndpoint(endpoint, path, method);
      });
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
  });
};
