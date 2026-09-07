test("Experiment on mapping", async ({ bench }) => {
  const src = new Set([1, 2, 3, 4, 5]);
  const mapper = (x: number) => x * 2;

  await bench.compare(
    bench("Array.from().map()", () => {
      Array.from(src).map(mapper);
    }),
    bench("Array.from(map)", () => {
      Array.from(src, mapper);
    }),
  );
});
