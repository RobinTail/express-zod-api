import "./src/zod-plugin"; // required for tests importing sources using the plugin methods
import type { NewPlugin } from "@vitest/pretty-format";
import { z } from "zod/v4";
import { ResultHandlerError } from "./src/errors";
import { getBrand } from "./src/metadata";

/** Takes cause and certain props of custom errors into account */
const errorSerializer: NewPlugin = {
  test: (subject) => subject instanceof Error,
  serialize: (error: Error, config, indentation, depth, refs, printer) => {
    const { name, message, cause } = error;
    const { handled } = error instanceof ResultHandlerError ? error : {};
    const { issues } = error instanceof z.ZodError ? error : {};
    const obj = Object.assign(
      {},
      issues ? { issues } : { message }, // ZodError.message is a serialization of issues (looks bad in snapshot)
      cause && { cause },
      handled && { handled },
    );
    return `${name}(${printer(obj, config, indentation, depth, refs)})`;
  },
};

const schemaSerializer: NewPlugin = {
  test: (subject) => subject instanceof z.ZodType,
  serialize: (entity: z.ZodType, config, indentation, depth, refs, printer) => {
    const serialization = z.toJSONSchema(entity, {
      unrepresentable: "any",
      override: ({ zodSchema, jsonSchema }) => {
        if (zodSchema._zod.def.type === "custom")
          jsonSchema["x-brand"] = getBrand(zodSchema);
      },
    });
    return printer(serialization, config, indentation, depth, refs);
  },
};

/**
 * @see https://github.com/vitest-dev/vitest/issues/5697
 * @see https://vitest.dev/guide/snapshot.html#custom-serializer
 */
const serializers = [errorSerializer, schemaSerializer];
for (const serializer of serializers) expect.addSnapshotSerializer(serializer);
