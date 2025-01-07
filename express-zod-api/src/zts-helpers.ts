import type ts from "typescript";
import { z } from "zod";
import { FlatObject } from "./common-helpers.ts";
import { SchemaHandler } from "./schema-walker.ts";

export type LiteralType = string | number | boolean;

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (schema: z.ZodTypeAny, produce: () => ts.TypeNode) => ts.TypeNode;
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
