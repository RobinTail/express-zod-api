import type { ts } from "./typescript-api";
import type { FlatObject } from "./common-helpers";
import type { SchemaHandler } from "./schema-walker";

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (
    key: object,
    produce: () => ts.TypeNode,
    proposedName?: string,
  ) => ts.TypeNode;
  /**
   * @desc Returns the underlying type kind of an alias reference for transform sampling.
   * @default undefined
   * */
  getAliasKind?: (node: ts.TypeNode) => ts.SyntaxKind | undefined;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
