import { bench, describe } from "vitest";
import { Fugue } from "../src";

describe("benchmarks", () => {
  const fugue = new Fugue("test");

  bench("simple", () => {
    const pos1 = fugue.createBetween(null, null);
    const pos2 = fugue.createBetween(pos1, null);
    fugue.createBetween(pos1, pos2);
  });

  bench("fugue", () => {
    const pos1 = fugue.createBetween(null, null);
    const pos2 = fugue.createBetween(pos1, null);
    fugue.createBetween(pos1, pos2);
  });

  bench("class instantiation", () => {
    const internal = new Fugue("test");

    const pos1 = internal.createBetween(null, null);
    const pos2 = internal.createBetween(pos1, null);
    internal.createBetween(pos1, pos2);
  });

  bench("multiple instances (100)", () => {
    const instances = Array.from(
      { length: 30 },
      (_, i) => new Fugue(`test${i}`),
    );
    const allPositions: string[] = [];

    // Create initial position for first instance
    const firstInstance = instances[0];
    if (firstInstance) {
      allPositions.push(firstInstance.createBetween(null, null));
    }

    // Each instance creates positions between existing positions
    for (const instance of instances) {
      for (let j = 0; j < 2000; j++) {
        // Pick two random existing positions or null
        const pos1 =
          allPositions.length > 0
            ? (allPositions[Math.floor(Math.random() * allPositions.length)] ??
              null)
            : null;
        const pos2 =
          allPositions.length > 0
            ? (allPositions[Math.floor(Math.random() * allPositions.length)] ??
              null)
            : null;

        let newPos: string;

        if (pos1 === pos2) {
          // If the two positions are the same, create a new position at the end
          newPos = instance.createBetween(pos1, null);
        } else {
          // If the two positions are different, create a new position between them
          const a = pos1 && pos2 ? (pos2 > pos1 ? pos1 : pos2) : null;
          const b = pos1 && pos2 ? (pos2 > pos1 ? pos2 : pos1) : null;

          newPos = instance.createBetween(a, b);
        }

        allPositions.push(newPos);
      }
    }

    for (const instance of instances) {
      console.log(instance.cacheSize);
    }
  });
});
