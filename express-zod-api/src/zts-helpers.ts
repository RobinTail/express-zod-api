import type ts from "typescript";
import { SchemaHandler } from "@express-zod-api/zod-to-ts";

export interface ZTSContext {
  isResponse: boolean;
  makeAlias: (key: object, produce: () => ts.TypeNode) => ts.TypeNode;
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;
