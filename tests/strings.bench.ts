import { bench, describe } from "vitest";
import { Fugue } from "../src";

describe("benchmarks", () => {
  bench("single", () => {
    const internal = new Fugue("test");

    const pos1 = internal.createBetween(null, null);
    const pos2 = internal.createBetween(pos1, null);
    internal.createBetween(pos1, pos2);
  });

  bench("multiple instances", () => {
    const instances = Array.from(
      { length: 100 },
      (_, i) => new Fugue(`client${i}`),
    );

    let firstKey: string | null = null;
    let lastKey: string | null = null;

    // Create initial position for first instance
    const firstInstance = instances[0];
    if (firstInstance) {
      firstKey = firstInstance.createBetween(null, null);
      lastKey = firstInstance.createBetween(firstKey, null);
    }

    let previousKey: string | null = firstKey;

    for (let j = 0; j < 10; j++) {
      for (const instance of instances) {
        const newPos = instance.createBetween(previousKey, lastKey);
        const newPos2 = instance.createBetween(previousKey, newPos);

        previousKey = newPos2;
      }
    }
  });
});
