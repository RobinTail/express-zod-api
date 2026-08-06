import type { FlatObject } from "./common-helpers";
import type { SchemaHandler } from "./schema-walker";
import type { TypeNode } from "./typescript-api";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (key: object, produce: () => TypeNode) => TypeNode;
}

export type Producer = SchemaHandler<TypeNode, ZTSContext>;
