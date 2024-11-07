import { SchemaObject, SchemaObjectType } from "openapi3-ts/oas31";
import { bench } from "vitest";

const current = (prev: SchemaObject): SchemaObjectType[] => {
  const current = typeof prev.type === "string" ? [prev.type] : prev.type || [];
  return current.includes("null") ? current : current.concat("null");
};

const featured = ({
  type,
}: SchemaObject): SchemaObjectType | SchemaObjectType[] => {
  if (type === "null") return type;
  if (typeof type === "string") return [type, "null"];
  return type ? [...new Set(type).add("null")] : "null";
};

describe.each<SchemaObject>([
  { type: "string" },
  { type: ["string"] },
  { type: undefined },
  { type: "null" },
  { type: ["string", "null"] },
  { type: ["string", "number", "boolean", "null"] },
])("Experiment for makeNullable %s", (subject) => {
  bench("current", () => {
    current(subject);
  });

  bench("featured", () => {
    featured(subject);
  });
});

describe.skip("Set", () => {
  bench("instance undefined", () => {
    new Set(undefined);
  });

  bench("instance from array", () => {
    new Set(["string"]);
  });

  const test = new Set();
  bench("adding", () => {
    test.add("null");
  });

  bench("spread", () => {
    return void [...test];
  });
});
