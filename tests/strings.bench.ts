import { bench, describe } from "vitest";
import { Fugue } from "../src";

describe("benchmarks", () => {
  bench("single", () => {
    const internal = new Fugue("test");

    const pos1 = internal.between(null, null);
    const pos2 = internal.between(pos1, null);
    internal.between(pos1, pos2);
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
      firstKey = firstInstance.between(null, null);
      lastKey = firstInstance.between(firstKey, null);
    }

    let previousKey: string | null = firstKey;

    for (let j = 0; j < 10; j++) {
      for (const instance of instances) {
        const newPos = instance.between(previousKey, lastKey);
        const newPos2 = instance.between(previousKey, newPos);

        previousKey = newPos2;
      }
    }
  });
});
