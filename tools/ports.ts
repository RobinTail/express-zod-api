const disposer = (function* () {
  let port = 8e3 + 1e2 * Number(process.env.VITEST_POOL_ID);
  while (true) yield port++;
})();

const reserved = {
  example: 8090,
  cjs: 8091,
  esm: 8092,
  compat: 8093,
};

export const givePort = (test?: keyof typeof reserved): number => {
  if (test) return reserved[test];
  const { value } = disposer.next();
  if (Object.values(reserved).includes(value)) return givePort();
  return value;
};
