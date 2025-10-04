import type ts from "typescript";
import { FlatObject } from "./common-helpers.ts";
import { SchemaHandler } from "./schema-walker.ts";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (key: object, produce: () => ts.TypeNode) => ts.TypeNode;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
