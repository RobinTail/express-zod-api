import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { ezBufferBrand } from "./buffer-schema";
import { getTransformedType, isSchema } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { hasCycle } from "./deep-checks";
import type { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand, type RawSchema } from "./raw-schema";
import {
  walkSchema,
  type FirstPartyKind,
  type HandlingRules,
} from "./schema-walker";
import {
  makeInterfacePropText,
  ensureTypeNode,
  f,
  makeInterfaceProp,
  makeLiteralType,
  makeUnion,
  ts,
  customizations,
} from "./typescript-api";
import type { Producer, ZTSContext } from "./zts-helpers";

const nodePath = {
  name: R.path([
    "name" satisfies keyof ts.PropertySignatureDeclaration,
    "text" satisfies keyof Exclude<
      NonNullable<ts.PropertySignatureDeclaration["name"]>,
      ts.ComputedPropertyName
    >,
  ]),
  type: R.path(["type" satisfies keyof ts.PropertySignatureDeclaration]),
  optional: R.path([
    "postfixToken" satisfies keyof ts.PropertySignatureDeclaration,
  ]),
};

const onLiteral: Producer = ({ _zod: { def } }: z.core.$ZodLiteral) => {
  const values = def.values.map((entry) =>
    entry === undefined
      ? ensureTypeNode(ts.SyntaxKind.UndefinedKeyword)
      : makeLiteralType(entry),
  );
  // ensured by runtime check since Zod 4.0.9 4e7a3ef180f6a5525d9021638e9df20b3ca50456
  return values.length === 1 ? values[0]! : makeUnion(values);
};

const onTemplateLiteral: Producer = (
  { _zod: { def } }: z.core.$ZodTemplateLiteral,
  { next },
) => {
  const { parts } = def;
  let idx = 0;
  const readText = () => {
    let text = "";
    while (idx < parts.length) {
      const part = parts[idx];
      if (isSchema(part)) break;
      idx++;
      text += part ?? ""; // Handle potential undefined values
    }
    return text;
  };
  const headText = readText();
  const head = f.createTemplateHead(headText, headText, ts.TokenFlags.None);
  const spans: ts.TemplateLiteralTypeSpan[] = [];
  while (idx < parts.length) {
    const schema = next(parts[idx++] as z.core.$ZodType);
    const text = readText();
    const textWrapper =
      idx < parts.length ? f.createTemplateMiddle : f.createTemplateTail;
    const span = f.createTemplateLiteralTypeSpan(
      schema,
      textWrapper(text, text, ts.TokenFlags.None),
    );
    spans.push(span);
  }
  if (!spans.length) return makeLiteralType(head.text);
  return f.createTemplateLiteralTypeNode(head, spans);
};

const onObject: Producer = (
  obj: z.core.$ZodObject,
  { isResponse, next, makeAlias },
) => {
  const produce = () => {
    const entries = Object.entries(obj._zod.def.shape);
    const members = entries.map<ts.TypeElement>(([key, value]) => {
      const { description: comment, deprecated: isDeprecated } =
        globalRegistry.get(value) || {};
      const isOptional =
        (isResponse ? value._zod.optout : value._zod.optin) === "optional";
      const hasUndefined =
        isOptional && !(value instanceof z.core.$ZodExactOptional);
      const typeNode = next(value);
      const member = makeInterfaceProp(key, typeNode, {
        isOptional,
        hasUndefined,
      });
      customizations.set(
        member,
        makeInterfacePropText(key, typeNode, {
          isOptional,
          hasUndefined,
          isDeprecated,
          comment,
        }),
      );
      return member;
    });
    const typeNode = f.createTypeLiteralNode(members);
    customizations.set(typeNode, (opts) => {
      const propTexts = members.map((one) => customizations.get(one)?.(opts));
      return propTexts.length ? `{\n${propTexts.join("\n")}\n}` : "{}";
    });
    return typeNode;
  };
  return hasCycle(obj, { io: isResponse ? "output" : "input" })
    ? makeAlias(obj, produce)
    : produce();
};

const onArray: Producer = ({ _zod: { def } }: z.core.$ZodArray, { next }) =>
  f.createArrayTypeNode(next(def.element));

const onEnum: Producer = ({ _zod: { def } }: z.core.$ZodEnum) =>
  makeUnion(R.map(makeLiteralType, Object.values(def.entries)));

const onSomeUnion: Producer = (
  { _zod: { def } }: z.core.$ZodUnion | z.core.$ZodDiscriminatedUnion,
  { next },
) => makeUnion(def.options.map(next));

const onNullable: Producer = (
  { _zod: { def } }: z.core.$ZodNullable,
  { next },
) => makeUnion([next(def.innerType), makeLiteralType(null)]);

const onTuple: Producer = ({ _zod: { def } }: z.core.$ZodTuple, { next }) =>
  f.createTupleTypeNode(
    def.items
      .map(next)
      .concat(def.rest === null ? [] : f.createRestTypeNode(next(def.rest))),
  );

const onRecord: Producer = ({ _zod: { def } }: z.core.$ZodRecord, { next }) => {
  const [keyNode, valueNode] = [def.keyType, def.valueType].map(next);
  const primary = ensureTypeNode("Record", [keyNode!, valueNode!]);
  const isLoose = def.mode === "loose";
  if (!isLoose) return primary;
  return f.createIntersectionTypeNode([
    primary,
    ensureTypeNode("Record", ["PropertyKey", valueNode!]),
  ]);
};

const intersect = R.tryCatch(
  (nodes: ts.TypeNode[]) => {
    if (!nodes.every(ts.isTypeLiteralNode)) throw new Error("Not objects");
    const members = R.chain(R.prop("members"), nodes);
    const uniqs = R.uniqWith((...props) => {
      if (!R.eqBy(nodePath.name, ...props)) return false;
      if (R.both(R.eqBy(nodePath.type), R.eqBy(nodePath.optional))(...props))
        return true;
      throw new Error("Has conflicting prop");
    }, members);
    const typeNode = f.createTypeLiteralNode(uniqs);
    const propFns = uniqs.map((m) => customizations.get(m));
    if (propFns.every(Boolean)) {
      customizations.set(typeNode, (opts) => {
        const propTexts = propFns.map((fn) => fn!(opts));
        return `{\n${propTexts.join("\n")}\n}`;
      });
    }
    return typeNode;
  },
  (_err, nodes) => f.createIntersectionTypeNode(nodes),
);

const onIntersection: Producer = (
  { _zod: { def } }: z.core.$ZodIntersection,
  { next },
) => intersect([def.left, def.right].map(next));

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer =>
  () =>
    ensureTypeNode(syntaxKind);

const onWrapped: Producer = (
  {
    _zod: { def },
  }:
    | z.core.$ZodReadonly
    | z.core.$ZodCatch
    | z.core.$ZodDefault
    | z.core.$ZodOptional
    | z.core.$ZodNonOptional
    | z.core.$ZodExactOptional,
  { next },
) => next(def.innerType);

const getFallback = (isResponse: boolean) =>
  ensureTypeNode(
    isResponse ? ts.SyntaxKind.UnknownKeyword : ts.SyntaxKind.AnyKeyword,
  );

const onPipeline: Producer = (
  { _zod: { def } }: z.core.$ZodPipe,
  { next, isResponse },
) => {
  const target = def[isResponse ? "out" : "in"];
  const opposite = def[isResponse ? "in" : "out"];
  if (!isSchema<z.core.$ZodTransform>(target, "transform")) return next(target);
  const opposingType = next(opposite);
  const samples = {
    [ts.SyntaxKind.AnyKeyword]: "",
    [ts.SyntaxKind.BigIntKeyword]: BigInt(0),
    [ts.SyntaxKind.BooleanKeyword]: false,
    [ts.SyntaxKind.NumberKeyword]: 0,
    [ts.SyntaxKind.ObjectKeyword]: {},
    [ts.SyntaxKind.StringKeyword]: "",
    [ts.SyntaxKind.UndefinedKeyword]: undefined,
  } satisfies Partial<Record<ts.KeywordTypeSyntaxKind, unknown>>;
  const sample = samples[opposingType.kind as keyof typeof samples];
  const targetType = getTransformedType(target, sample);
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
  return ensureTypeNode(
    (targetType && resolutions[targetType]) || getFallback(isResponse),
  );
};

const onNull: Producer = () => makeLiteralType(null);

const onLazy: Producer = (
  { _zod: { def } }: z.core.$ZodLazy,
  { makeAlias, next },
) => makeAlias(def.getter, () => next(def.getter()));

const onBuffer: Producer = () => ensureTypeNode("Blob");

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
    onMissing: ({}, { isResponse }) => getFallback(isResponse),
    ctx,
  });
