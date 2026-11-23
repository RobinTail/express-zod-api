import { ensureTypeNode, f, replaceRefs, ts } from "../src/typescript-api";

/** The original implementation, kept here as the baseline. */
const replaceRefsTransform = (
  node: ts.TypeNode,
  replacer: (name: string) => string | undefined,
) =>
  ts.transform(node, [
    (ctx) => (root) => {
      const visit = (subject: ts.Node): ts.Node => {
        const name =
          ts.isTypeReferenceNode(subject) && ts.isIdentifier(subject.typeName)
            ? replacer(subject.typeName.text)
            : undefined;
        return name
          ? ensureTypeNode(name)
          : ts.visitEachChild(subject, visit, ctx);
      };
      return ts.visitNode(root, visit) as ts.TypeNode;
    },
  ]).transformed[0]!; // single node given

const makeNode = () =>
  f.createTypeLiteralNode(
    Array.from({ length: 20 }, (_, idx) =>
      f.createPropertySignature(
        undefined,
        `field${idx}`,
        undefined,
        f.createUnionTypeNode([
          f.createTypeReferenceNode("Old"),
          f.createArrayTypeNode(f.createTypeReferenceNode("Keep")),
          f.createTypeReferenceNode("Box", [f.createTypeReferenceNode("Old")]),
        ]),
      ),
    ),
  );

const replace = (name: string) => (name === "Old" ? "New" : undefined);

test("Experiment for replaceRefs with replacements", async ({ bench }) => {
  const node = makeNode();

  await bench.compare(
    bench("old (ts.transform)", () => {
      void replaceRefsTransform(node, replace);
    }),
    bench("new (ts.visitNode)", () => {
      void replaceRefs(node, replace);
    }),
  );
});
