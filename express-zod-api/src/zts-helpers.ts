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
  // @todo remove it in favor of z.interface
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
