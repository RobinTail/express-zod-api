import type ts from "typescript";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";
import type { TypescriptAPI } from "./typescript-api";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (key: object, produce: () => ts.TypeNode) => ts.TypeNode;
  api: TypescriptAPI;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
