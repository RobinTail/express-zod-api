import { bench } from "vitest";

const routePathParamsRegex = /:([A-Za-z0-9_]+)/g;

const normalizeParams = (path: string) => {
  let idx = 1;
  return path.replace(routePathParamsRegex, () => `:${idx++}`);
};

describe("Experiment for checkDuplicate normalization", () => {
  const pathNoParams = "/users/check/some/stuff";
  const pathWithParams = "/users/:userId/books/:bookId/pages/:pageNum";
  const method = "get" as const;
  const visitedWith = new Set<string>();
  const visitedWithout = new Set<string>();

  bench("with normalization and params", () => {
    const normalized = pathWithParams.includes(":")
      ? normalizeParams(pathWithParams)
      : pathWithParams;
    const key = `${method} ${normalized}`;
    void visitedWith.has(key);
    visitedWith.add(key);
  });

  bench("with normalization no params", () => {
    const normalized = pathNoParams.includes(":")
      ? normalizeParams(pathNoParams)
      : pathNoParams;
    const key = `${method} ${normalized}`;
    void visitedWith.has(key);
    visitedWith.add(key);
  });

  bench("without normalization (baseline)", () => {
    const key = `${method} ${pathWithParams}`;
    void visitedWithout.has(key);
    visitedWithout.add(key);
  });
});
