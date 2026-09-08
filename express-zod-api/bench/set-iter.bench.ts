test("Set iteration", async ({ bench }) => {
  const set = new Set([1, 2]);
  const mapper = (x: number) => x * 2;
  await bench.compare(
    bench("spread map", () => {
      [...set].map(mapper);
    }),
    bench("values map", () => {
      set.values().map(mapper);
    }),
  );
});
