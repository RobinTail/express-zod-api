import { chain, prop } from "ramda";
import ts from "typescript";
import { bench } from "vitest";
import { f } from "../../src/integration-helpers";

export const current = (nodes: ts.TypeLiteralNode[]) =>
  f.createTypeLiteralNode(nodes.flatMap(({ members }) => members));

export const feat = (nodes: ts.TypeLiteralNode[]) =>
  f.createTypeLiteralNode(chain(prop("members"), nodes));

describe("Experiment on flatMap", () => {
  const subj = [
    f.createTypeLiteralNode([
      f.createPropertySignature(
        undefined,
        "test1",
        undefined,
        f.createTypeReferenceNode("test1"),
      ),
    ]),
    f.createTypeLiteralNode([
      f.createPropertySignature(
        undefined,
        "test2",
        undefined,
        f.createTypeReferenceNode("test2"),
      ),
    ]),
  ];

  bench("flatMap", () => {
    current(subj);
  });

  bench("chain+prop", () => {
    feat(subj);
  });
});
