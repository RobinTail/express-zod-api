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
    method: Method | AuxMethod
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
    if (segment.match(/\//)) {
      throw new RoutingError(
        "Routing elements should not contain '/' character.\n" +
          `The error caused by ${
            parentPath
              ? `'${parentPath}' route that has a '${segment}'`
              : `'${segment}'`
          } entry.`
      );
    }
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
      Object.entries<AbstractEndpoint>(element.methods).forEach(
        ([method, endpoint]) => {
          onEndpoint(endpoint, path, method as Method);
        }
      );
      if (hasCors && Object.keys(element.methods).length > 0) {
        const [firstMethod, ...siblingMethods] = Object.keys(
          element.methods
        ) as Method[];
        const firstEndpoint = element.methods[firstMethod]!;
        firstEndpoint._setSiblingMethods(siblingMethods);
        onEndpoint(firstEndpoint, path, "options");
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
