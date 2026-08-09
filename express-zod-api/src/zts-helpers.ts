import type { ts } from "./typescript-api";
import type { FlatObject } from "./common-helpers";
import type { SchemaHandler } from "./schema-walker";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (key: object, produce: () => ts.TypeNode) => ts.TypeNode;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
