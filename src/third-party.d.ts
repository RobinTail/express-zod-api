declare module "zod-to-ts" {
  import { ZodTypeAny } from "zod";
  import ts from "typescript";

  declare type ZodToTsOptions = {
    resolveNativeEnums?: boolean;
  };
  declare type RequiredZodToTsOptions = Required<ZodToTsOptions>;
  declare type ZodToTsStore = {
    nativeEnums: ts.EnumDeclaration[];
  };
  declare type ZodToTsReturn = {
    node: ts.TypeNode;
    store: ZodToTsStore;
  };
  declare type GetTypeFunction = (
    typescript: typeof ts,
    identifier: string,
    options: RequiredZodToTsOptions
  ) => ts.Identifier | ts.TypeNode;
  declare type GetType = {
    getType?: GetTypeFunction;
  };

  declare const createTypeAlias: (
    node: ts.TypeNode,
    identifier: string,
    comment?: string | undefined
  ) => ts.TypeAliasDeclaration;
  declare const printNode: (
    node: ts.Node,
    printerOptions?: ts.PrinterOptions | undefined
  ) => string;
  declare const withGetType: <T extends ZodTypeAny & GetType>(
    schema: T,
    getType: GetTypeFunction
  ) => T;

  declare const resolveOptions: (
    raw?: ZodToTsOptions | undefined
  ) => RequiredZodToTsOptions;
  declare const zodToTs: (
    zod: ZodTypeAny,
    identifier?: string | undefined,
    options?: ZodToTsOptions | undefined
  ) => ZodToTsReturn;

  export {
    GetType,
    ZodToTsOptions,
    createTypeAlias,
    printNode,
    resolveOptions,
    withGetType,
    zodToTs,
  };
}
