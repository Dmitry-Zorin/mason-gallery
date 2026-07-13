import { describe, expect, it } from "vitest";
import { makeShuffleComparator, nextShuffleSeed } from "@/lib/shuffle";

/** Order a list of source ids using the seeded shuffle comparator. */
function order(sources: string[], seed: number): string[] {
  const cmp = makeShuffleComparator(seed);
  return [...sources].sort(cmp);
}

const SOURCES = Array.from({ length: 200 }, (_, i) => `img-${i}.jpg`);

describe("makeShuffleComparator", () => {
  it("is deterministic for a fixed seed", () => {
    expect(order(SOURCES, 42)).toEqual(order(SOURCES, 42));
  });

  it("does not depend on the input order (stable under append/refresh)", () => {
    const seed = 1234;
    const forward = order(SOURCES, seed);
    const reversed = order([...SOURCES].reverse(), seed);
    const shuffledInput = order(
      [...SOURCES].sort(() => -1),
      seed,
    );
    expect(reversed).toEqual(forward);
    expect(shuffledInput).toEqual(forward);
  });

  it("keeps existing items' relative order when new items are added", () => {
    const seed = 7;
    const full = order(SOURCES, seed);
    // Simulate a later scan batch: drop half the sources, order what remains.
    const subset = SOURCES.filter((_, i) => i % 2 === 0);
    const subsetOrdered = order(subset, seed);
    const projected = full.filter((s) => subset.includes(s));
    expect(subsetOrdered).toEqual(projected);
  });

  it("actually reorders (not the identity order)", () => {
    // With 200 items a real shuffle is astronomically unlikely to equal input.
    expect(order(SOURCES, 99)).not.toEqual(SOURCES);
  });

  it("produces different orders for different seeds", () => {
    expect(order(SOURCES, 1)).not.toEqual(order(SOURCES, 2));
  });

  it("is a total order with no dropped or duplicated items", () => {
    const result = order(SOURCES, 555);
    expect(result).toHaveLength(SOURCES.length);
    expect(new Set(result)).toEqual(new Set(SOURCES));
  });
});

describe("nextShuffleSeed", () => {
  it("returns a 32-bit unsigned integer", () => {
    for (let i = 0; i < 50; i++) {
      const seed = nextShuffleSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(0x1_0000_0000);
    }
  });
});
