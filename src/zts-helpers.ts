import type ts from "typescript";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";

export type LiteralType = string | number | boolean;

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (
    schema: z.ZodTypeAny,
    produce: () => ts.TypeNode,
  ) => ts.TypeReferenceNode;
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
