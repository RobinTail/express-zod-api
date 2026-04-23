import { bench, describe } from "vitest";

const smallQueue = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  data: `item-${i}`,
}));
const mediumQueue = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  data: `item-${i}`,
}));
const largeQueue = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  data: `item-${i}`,
}));

const queues = [
  [smallQueue, "small (5)"],
  [mediumQueue, "medium (20)"],
  [largeQueue, "large (100)"],
] as const;

describe.each(queues)("$1", (queue) => {
  bench("shift() approach", () => {
    const q = [...queue];
    while (q.length) q.shift();
  });

  bench("index approach", () => {
    const q = [...queue];
    let idx = 0;
    while (idx < q.length) idx++;
  });

  bench("pop() reverse", () => {
    const q = [...queue].reverse();
    while (q.length) q.pop();
  });

  bench("forEach", () => {
    const q = [...queue];
    q.forEach(() => {});
  });
});
