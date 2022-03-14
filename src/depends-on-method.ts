import { Endpoint } from "./endpoint";
import { DependsOnMethodError } from "./errors";
import { Method } from "./method";

export class DependsOnMethod {
  constructor(
    public readonly methods: {
      [K in Method]?:
        | Endpoint<any, any, any, K, any, any>
        | Endpoint<any, any, any, Method, any, any>;
    }
  ) {
    (Object.keys(methods) as (keyof typeof methods)[]).forEach((key) => {
      if (key in methods) {
        const endpointMethods = methods[key]?.getMethods() || [];
        if (!endpointMethods.includes(key)) {
          throw new DependsOnMethodError(
            `The endpoint assigned to the '${key}' parameter must have at least this method in its specification.\n` +
              "This error should prevent mistakes during the development process.\n" +
              "Example:\n\n" +
              `new ${this.constructor.name}({\n` +
              `  ${key}: endpointsFactory.build({\n` +
              `    methods: ['${key}', ` +
              ((methods[key]?.getMethods() || [])
                .map((m) => `'${m}'`)
                .join(", ") || "...") +
              "]\n" +
              `    // or method: '${key}'\n` +
              "    ...\n" +
              "  })\n" +
              "});\n"
          );
        }
      }
    });
  }
}
