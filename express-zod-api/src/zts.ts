import * as R from "ramda";
import ts from "typescript";
import { globalRegistry, z } from "zod";
import { ezBufferBrand } from "./buffer-schema";
import { getTransformedType, isSchema } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { hasCycle } from "./deep-checks";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand, RawSchema } from "./raw-schema";
import { FirstPartyKind, HandlingRules, walkSchema } from "./schema-walker";
import type { TypescriptAPI } from "./typescript-api";
import { Producer, ZTSContext } from "./zts-helpers";

const samples = {
  [ts.SyntaxKind.AnyKeyword]: "",
  [ts.SyntaxKind.BigIntKeyword]: BigInt(0),
  [ts.SyntaxKind.BooleanKeyword]: false,
  [ts.SyntaxKind.NumberKeyword]: 0,
  [ts.SyntaxKind.ObjectKeyword]: {},
  [ts.SyntaxKind.StringKeyword]: "",
  [ts.SyntaxKind.UndefinedKeyword]: undefined,
} satisfies Partial<Record<ts.KeywordTypeSyntaxKind, unknown>>;

const nodePath = {
  name: R.path([
    "name" satisfies keyof ts.TypeElement,
    "text" satisfies keyof Exclude<
      NonNullable<ts.TypeElement["name"]>,
      ts.ComputedPropertyName
    >,
  ]),
  type: R.path(["type" satisfies keyof ts.PropertySignature]),
  optional: R.path(["questionToken" satisfies keyof ts.TypeElement]),
};

const onLiteral: Producer = (
  { _zod: { def } }: z.core.$ZodLiteral,
  { api },
) => {
  const values = def.values.map((entry) =>
    entry === undefined
      ? api.ensureTypeNode(ts.SyntaxKind.UndefinedKeyword)
      : api.makeLiteralType(entry),
  );
  return values.length === 1 ? values[0] : api.makeUnion(values);
};

const onTemplateLiteral: Producer = (
  { _zod: { def } }: z.core.$ZodTemplateLiteral,
  { next, api },
) => {
  const parts = [...def.parts];
  const shiftText = () => {
    let text = "";
    while (parts.length) {
      const part = parts.shift();
      if (isSchema(part)) {
        parts.unshift(part);
        break;
      }
      text += part ?? ""; // Handle potential undefined values
    }
    return text;
  };
  const head = api.f.createTemplateHead(shiftText());
  const spans: ts.TemplateLiteralTypeSpan[] = [];
  while (parts.length) {
    const schema = next(parts.shift() as z.core.$ZodType);
    const text = shiftText();
    const textWrapper = parts.length
      ? api.f.createTemplateMiddle
      : api.f.createTemplateTail;
    spans.push(api.f.createTemplateLiteralTypeSpan(schema, textWrapper(text)));
  }
  if (!spans.length) return api.makeLiteralType(head.text);
  return api.f.createTemplateLiteralType(head, spans);
};

const onObject: Producer = (
  obj: z.core.$ZodObject,
  { isResponse, next, makeAlias, api },
) => {
  const produce = () => {
    const members = Object.entries(obj._zod.def.shape).map<ts.TypeElement>(
      ([key, value]) => {
        const { description: comment, deprecated: isDeprecated } =
          globalRegistry.get(value) || {};
        return api.makeInterfaceProp(key, next(value), {
          comment,
          isDeprecated,
          isOptional:
            (isResponse ? value._zod.optout : value._zod.optin) === "optional",
        });
      },
    );
    return api.f.createTypeLiteralNode(members);
  };
  return hasCycle(obj, { io: isResponse ? "output" : "input" })
    ? makeAlias(obj, produce)
    : produce();
};

const onArray: Producer = (
  { _zod: { def } }: z.core.$ZodArray,
  { next, api },
) => api.f.createArrayTypeNode(next(def.element));

const onEnum: Producer = ({ _zod: { def } }: z.core.$ZodEnum, { api }) =>
  api.makeUnion(Object.values(def.entries).map(api.makeLiteralType.bind(api)));

const onSomeUnion: Producer = (
  { _zod: { def } }: z.core.$ZodUnion | z.core.$ZodDiscriminatedUnion,
  { next, api },
) => api.makeUnion(def.options.map(next));

const makeSample = (produced: ts.TypeNode) =>
  samples?.[produced.kind as keyof typeof samples];

const onNullable: Producer = (
  { _zod: { def } }: z.core.$ZodNullable,
  { next, api },
) => api.makeUnion([next(def.innerType), api.makeLiteralType(null)]);

const onTuple: Producer = (
  { _zod: { def } }: z.core.$ZodTuple,
  { next, api },
) =>
  api.f.createTupleTypeNode(
    def.items
      .map(next)
      .concat(
        def.rest === null ? [] : api.f.createRestTypeNode(next(def.rest)),
      ),
  );

const onRecord: Producer = (
  { _zod: { def } }: z.core.$ZodRecord,
  { next, api },
) => api.ensureTypeNode("Record", [def.keyType, def.valueType].map(next));

const intersect = R.tryCatch(
  (api: TypescriptAPI, nodes: ts.TypeNode[]) => {
    if (!nodes.every(ts.isTypeLiteralNode)) throw new Error("Not objects");
    const members = R.chain(R.prop("members"), nodes);
    const uniqs = R.uniqWith((...props) => {
      if (!R.eqBy(nodePath.name, ...props)) return false;
      if (R.both(R.eqBy(nodePath.type), R.eqBy(nodePath.optional))(...props))
        return true;
      throw new Error("Has conflicting prop");
    }, members);
    return api.f.createTypeLiteralNode(uniqs);
  },
  (_err, api, nodes) => api.f.createIntersectionTypeNode(nodes),
);

const onIntersection: Producer = (
  { _zod: { def } }: z.core.$ZodIntersection,
  { next, api },
) => intersect(api, [def.left, def.right].map(next));

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer =>
  ({}, { api }) =>
    api.ensureTypeNode(syntaxKind);

const onWrapped: Producer = (
  {
    _zod: { def },
  }:
    | z.core.$ZodReadonly
    | z.core.$ZodCatch
    | z.core.$ZodDefault
    | z.core.$ZodOptional
    | z.core.$ZodNonOptional,
  { next },
) => next(def.innerType);

const getFallback = (api: TypescriptAPI, isResponse: boolean) =>
  api.ensureTypeNode(
    isResponse ? ts.SyntaxKind.UnknownKeyword : ts.SyntaxKind.AnyKeyword,
  );

const onPipeline: Producer = (
  { _zod: { def } }: z.core.$ZodPipe,
  { next, isResponse, api },
) => {
  const target = def[isResponse ? "out" : "in"];
  const opposite = def[isResponse ? "in" : "out"];
  if (!isSchema<z.core.$ZodTransform>(target, "transform")) return next(target);
  const opposingType = next(opposite);
  const targetType = getTransformedType(target, makeSample(opposingType));
  const resolutions: Partial<
    Record<NonNullable<typeof targetType>, ts.KeywordTypeSyntaxKind>
  > = {
    number: ts.SyntaxKind.NumberKeyword,
    bigint: ts.SyntaxKind.BigIntKeyword,
    boolean: ts.SyntaxKind.BooleanKeyword,
    string: ts.SyntaxKind.StringKeyword,
    undefined: ts.SyntaxKind.UndefinedKeyword,
    object: ts.SyntaxKind.ObjectKeyword,
  };
  return api.ensureTypeNode(
    (targetType && resolutions[targetType]) || getFallback(api, isResponse),
  );
};

const onNull: Producer = ({}, { api }) => api.makeLiteralType(null);

const onLazy: Producer = (
  { _zod: { def } }: z.core.$ZodLazy,
  { makeAlias, next },
) => makeAlias(def.getter, () => next(def.getter()));

const onBuffer: Producer = ({}, { api }) => api.ensureTypeNode("Buffer");

const onRaw: Producer = (schema: RawSchema, { next }) =>
  next(schema._zod.def.shape.raw);

const producers: HandlingRules<
  ts.TypeNode,
  ZTSContext,
  FirstPartyKind | ProprietaryBrand
> = {
  string: onPrimitive(ts.SyntaxKind.StringKeyword),
  number: onPrimitive(ts.SyntaxKind.NumberKeyword),
  bigint: onPrimitive(ts.SyntaxKind.BigIntKeyword),
  boolean: onPrimitive(ts.SyntaxKind.BooleanKeyword),
  any: onPrimitive(ts.SyntaxKind.AnyKeyword),
  undefined: onPrimitive(ts.SyntaxKind.UndefinedKeyword),
  [ezDateInBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  [ezDateOutBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  never: onPrimitive(ts.SyntaxKind.NeverKeyword),
  void: onPrimitive(ts.SyntaxKind.UndefinedKeyword),
  unknown: onPrimitive(ts.SyntaxKind.UnknownKeyword),
  null: onNull,
  array: onArray,
  tuple: onTuple,
  record: onRecord,
  object: onObject,
  literal: onLiteral,
  template_literal: onTemplateLiteral,
  intersection: onIntersection,
  union: onSomeUnion,
  default: onWrapped,
  enum: onEnum,
  optional: onWrapped,
  nonoptional: onWrapped,
  nullable: onNullable,
  catch: onWrapped,
  pipe: onPipeline,
  lazy: onLazy,
  readonly: onWrapped,
  [ezBufferBrand]: onBuffer,
  [ezRawBrand]: onRaw,
};

export const zodToTs = (
  schema: z.ZodType,
  {
    brandHandling,
    ctx,
  }: {
    brandHandling?: HandlingRules<ts.TypeNode, ZTSContext>;
    ctx: ZTSContext;
  },
) =>
  walkSchema(schema, {
    rules: { ...brandHandling, ...producers },
    onMissing: ({}, { isResponse, api }) => getFallback(api, isResponse),
    ctx,
  });
