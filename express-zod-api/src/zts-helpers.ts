import type ts from "typescript";
import type { FlatObject } from "./common-helpers";
import type { SchemaHandler } from "./schema-walker";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  /** @desc Declares the type produced for the key once and returns a reference to it, named as proposed if possible */
  makeAlias: (
    key: object,
    produce: () => ts.TypeNode,
    proposedName?: string,
  ) => ts.TypeNode;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
