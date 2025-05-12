const disposer = (function* () {
  let port = 8e3 + 1e2 * Number(process.env.VITEST_POOL_ID);
  while (true) yield port++;
})();

export const givePort = (test?: "example", reserved = 8090): number => {
  if (test) return reserved;
  const { value } = disposer.next();
  if (value === reserved) return givePort();
  return value;
};
