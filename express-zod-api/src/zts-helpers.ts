import type { $ZodType } from "@zod/core";
import type ts from "typescript";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (
    schema: $ZodType | (() => $ZodType),
    produce: () => ts.TypeNode,
  ) => ts.TypeNode;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
